import Database, { Database as DatabaseType } from 'better-sqlite3';
import { z } from 'zod';
import { JournalEntry, JournalLine, JournalEntrySchema } from '@dms/shared';
import crypto from 'crypto';
import { InsightService } from './insightService';

export class AccountingService {
    private db: DatabaseType;
    private insightService: InsightService;

    constructor(db: DatabaseType) {
        this.db = db;
        this.insightService = new InsightService(db);
    }

    // --- Account Management ---

    createAccount(account: { code: string; name: string; type: string; parent_id?: number | null; is_system?: boolean; is_active?: number | boolean; branch_id?: number | null }) {
        const stmt = this.db.prepare(
            'INSERT INTO accounts (code, name, type, parent_id, is_system, is_active, branch_id) VALUES (@code, @name, @type, @parent_id, @is_system, @is_active, @branch_id)'
        );
        const info = stmt.run({
            ...account,
            parent_id: account.parent_id ?? null,
            is_system: account.is_system ? 1 : 0,
            is_active: typeof account.is_active === 'boolean' ? (account.is_active ? 1 : 0) : (account.is_active ?? 1),
            branch_id: account.branch_id ?? null
        });

        const accountId = info.lastInsertRowid as number;

        // Trigger Classification Suggestion
        this.insightService.suggestAccountClassification(account.name, accountId);

        return { ...account, id: accountId };
    }

    listAccounts(search?: string, branchId?: number | null) {
        const clauses: string[] = [];
        const params: any[] = [];
        const query = (search || '').trim();
        if (query.length >= 2) {
            clauses.push('(code LIKE ? OR name LIKE ?)');
            params.push(`%${query}%`, `%${query}%`);
        }
        if (branchId !== undefined) {
            clauses.push('branch_id IS ?');
            params.push(branchId === null ? null : branchId);
        }
        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        return this.db.prepare(`
            SELECT * FROM accounts
            ${whereClause}
            ORDER BY code
        `).all(...params);
    }

    updateAccount(id: number, updates: { code?: string; name?: string; type?: string; parent_id?: number | null; is_active?: number | boolean }) {
        const current = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as any;
        if (!current) throw new Error('Account not found');
        const next = {
            ...current,
            ...updates
        };
        this.db.prepare(`
            UPDATE accounts
            SET code = @code,
                name = @name,
                type = @type,
                parent_id = @parent_id,
                is_active = @is_active
            WHERE id = @id
        `).run({
            id,
            code: next.code,
            name: next.name,
            type: next.type,
            parent_id: next.parent_id ?? null,
            is_active: typeof next.is_active === 'boolean' ? (next.is_active ? 1 : 0) : (next.is_active ?? 1)
        });
        return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
    }

    deleteAccount(id: number) {
        const account = this.db.prepare('SELECT id, party_type, party_id FROM accounts WHERE id = ?').get(id) as any;
        if (!account) {
            throw new Error('Account not found');
        }
        const child = this.db.prepare('SELECT 1 FROM accounts WHERE parent_id = ? LIMIT 1').get(id);
        if (child) {
            throw new Error('Account has child accounts and cannot be deleted.');
        }
        const referenced = this.db.prepare('SELECT 1 FROM journal_lines WHERE account_id = ? LIMIT 1').get(id);
        if (referenced) {
            throw new Error('Account is referenced by journal entries.');
        }
        const linkedParty = this.db.prepare(`
            SELECT 1
            FROM accounts
            WHERE id = ?
              AND party_type IS NOT NULL
              AND party_id IS NOT NULL
            LIMIT 1
        `).get(id);
        if (linkedParty) {
            throw new Error('Account is linked to a customer or supplier and cannot be deleted.');
        }
        const linkedCustomer = this.db.prepare(`
            SELECT 1 FROM customers
            WHERE receivable_account_id = ? OR advance_account_id = ?
            LIMIT 1
        `).get(id, id);
        if (linkedCustomer) {
            throw new Error('Account is linked to a customer and cannot be deleted.');
        }
        const linkedSupplier = this.db.prepare(`
            SELECT 1 FROM suppliers
            WHERE payable_account_id = ? OR advance_account_id = ?
            LIMIT 1
        `).get(id, id);
        if (linkedSupplier) {
            throw new Error('Account is linked to a supplier and cannot be deleted.');
        }
        const info = this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
        return { success: true };
    }

    // --- Journal Entry Management ---

    createJournalEntry(
        entry: Omit<JournalEntry, 'id' | 'posted'> & { branch_id?: number | null; reversed_of?: string | null },
        options: { allowUnbalanced?: boolean; unbalancedReason?: string | null; createdBy?: number | null } = {}
    ): JournalEntry {
        const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.001;

        for (const line of entry.lines) {
            if ((line.debit || 0) < 0 || (line.credit || 0) < 0) {
                throw new Error('Journal lines cannot contain negative amounts');
            }
            if ((line.debit || 0) > 0 && (line.credit || 0) > 0) {
                throw new Error('A journal line cannot contain both debit and credit amounts');
            }
        }

        if (!options.allowUnbalanced && !isBalanced) {
            throw new Error(`Unbalanced Entry: Debit ${totalDebit} != Credit ${totalCredit}`);
        }
        if (options.allowUnbalanced && !isBalanced && !String(options.unbalancedReason || '').trim()) {
            throw new Error('A reason is required for an unbalanced draft journal entry');
        }

        this.assertSourceCanBeUsed(entry.source_type, entry.source_id ?? null);

        const id = crypto.randomUUID();

        const insertEntry = this.db.prepare(`
            INSERT INTO journal_entries (
                id, date, description, posted, source_type, source_id,
                reversed_of, branch_id, unbalanced_reason, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const insertLine = this.db.prepare('INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)');

        const transaction = this.db.transaction(() => {
            insertEntry.run(
                id,
                entry.date,
                entry.description,
                0,
                entry.source_type,
                entry.source_id,
                (entry as any).reversed_of || null,
                entry.branch_id ?? null,
                isBalanced ? null : options.unbalancedReason ?? null,
                options.createdBy ?? null
            );
            for (const line of entry.lines) {
                insertLine.run(id, line.account_id, line.debit, line.credit, line.description || '');
            }
        });

        transaction();

        return { ...entry, id, posted: false };
    }

    postEntry(id: string, userId?: number): void {
        const entry = this.db.prepare(`
            SELECT id, posted, source_type, source_id
            FROM journal_entries
            WHERE id = ?
        `).get(id) as { id: string; posted: number; source_type: string; source_id: string | null } | undefined;
        if (!entry) {
            throw new Error('Entry not found');
        }
        if (entry.posted) {
            throw new Error('Entry is already posted');
        }

        const totals = this.db.prepare(`
            SELECT SUM(debit) as total_debit, SUM(credit) as total_credit
            FROM journal_lines WHERE entry_id = ?
        `).get(id) as { total_debit: number; total_credit: number };
        if (Math.abs((totals.total_debit || 0) - (totals.total_credit || 0)) > 0.001) {
            throw new Error('Entry is not balanced');
        }
        this.assertSourceCanBeUsed(entry.source_type, entry.source_id, id);

        const stmt = this.db.prepare(`
            UPDATE journal_entries
            SET posted = 1, posted_at = datetime('now'), posted_by = ?
            WHERE id = ? AND posted = 0
        `);
        const info = stmt.run(userId ?? null, id);
    }

    private assertSourceCanBeUsed(sourceType: string, sourceId?: string | null, currentEntryId?: string): void {
        if (!sourceId || sourceType === 'MANUAL' || sourceType === 'REVERSAL') {
            return;
        }
        const duplicate = this.db.prepare(`
            SELECT id
            FROM journal_entries
            WHERE source_type = ?
              AND source_id = ?
              AND posted = 1
              AND id != COALESCE(?, '')
            LIMIT 1
        `).get(sourceType, sourceId, currentEntryId ?? null) as { id: string } | undefined;
        if (duplicate) {
            throw new Error(`Source document ${sourceType}/${sourceId} has already been posted`);
        }
    }

    listJournalEntries(filters: { status?: 'draft' | 'posted'; startDate?: string; endDate?: string; search?: string; branchId?: number } = {}) {
        const clauses: string[] = [];
        const params: any[] = [];

        if (filters.status === 'posted') {
            clauses.push('je.posted = 1');
        }
        if (filters.status === 'draft') {
            clauses.push('je.posted = 0');
        }
        if (filters.startDate) {
            clauses.push('je.date >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            clauses.push('je.date <= ?');
            params.push(filters.endDate);
        }
        if (filters.search && filters.search.trim().length >= 2) {
            clauses.push('(je.id LIKE ? OR je.description LIKE ? OR je.source_type LIKE ? OR je.source_id LIKE ?)');
            const q = `%${filters.search.trim()}%`;
            params.push(q, q, q, q);
        }
        if (filters.branchId !== undefined) {
            clauses.push('je.branch_id = ?');
            params.push(filters.branchId);
        }

        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        return this.db.prepare(`
            SELECT je.*, SUM(jl.debit) as total_debit, SUM(jl.credit) as total_credit
            FROM journal_entries je
            LEFT JOIN journal_lines jl ON je.id = jl.entry_id
            ${whereClause}
            GROUP BY je.id
            ORDER BY je.date DESC, je.created_at DESC
        `).all(...params);
    }

    getJournalEntry(id: string) {
        const entry = this.db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
        if (!entry) return null;
        const lines = this.db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?').all(id);
        const totals = this.db.prepare(`
            SELECT SUM(debit) as total_debit, SUM(credit) as total_credit
            FROM journal_lines WHERE entry_id = ?
        `).get(id) as { total_debit: number; total_credit: number };
        return { ...entry, lines, total_debit: totals.total_debit || 0, total_credit: totals.total_credit || 0 };
    }

    updateJournalEntry(id: string, data: { date: string; description: string; lines: JournalLine[]; unbalancedReason?: string | null }) {
        const entry = this.db.prepare('SELECT posted FROM journal_entries WHERE id = ?').get(id) as { posted: number } | undefined;
        if (!entry) throw new Error('Entry not found');
        if (entry.posted) throw new Error('Posted journal entries cannot be edited');
        const totalDebit = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
        const totalCredit = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
        const isBalanced = Math.abs(totalDebit - totalCredit) <= 0.001;
        if (!isBalanced && !String(data.unbalancedReason || '').trim()) {
            throw new Error('A reason is required for an unbalanced draft journal entry');
        }

        const transaction = this.db.transaction(() => {
            this.db.prepare('UPDATE journal_entries SET date = ?, description = ?, unbalanced_reason = ?, updated_at = datetime(\'now\') WHERE id = ?')
                .run(data.date, data.description, isBalanced ? null : data.unbalancedReason ?? null, id);
            this.db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(id);
            const insertLine = this.db.prepare('INSERT INTO journal_lines (entry_id, account_id, debit, credit, description) VALUES (?, ?, ?, ?, ?)');
            for (const line of data.lines) {
                insertLine.run(id, line.account_id, line.debit, line.credit, line.description || '');
            }
        });

        transaction();
        return this.getJournalEntry(id);
    }

    reverseEntry(id: string, userId?: number) {
        const entry = this.getJournalEntry(id) as any;
        if (!entry) throw new Error('Entry not found');
        if (!entry.posted) throw new Error('Only posted entries can be reversed');

        const reverseLines = (entry.lines || []).map((line: any) => ({
            account_id: line.account_id,
            debit: line.credit || 0,
            credit: line.debit || 0,
            description: `Reversal of ${id}`
        }));

        const reversal = this.createJournalEntry({
            date: new Date().toISOString(),
            description: `Reversal of ${entry.description}`,
            source_type: 'REVERSAL',
            source_id: id,
            branch_id: entry.branch_id ?? null,
            lines: reverseLines,
            reversed_of: id
        } as any);

        this.postEntry(reversal.id!, userId);
        return reversal;
    }

    // --- Reporting ---

    getTrialBalance(filters: { startDate?: string; endDate?: string; branchId?: number } = {}) {
        const joinClauses: string[] = ['je.posted = 1'];
        const params: any[] = [];

        if (filters.startDate) {
            joinClauses.push('je.date >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            joinClauses.push('je.date <= ?');
            params.push(filters.endDate);
        }
        if (filters.branchId !== undefined) {
            joinClauses.push('je.branch_id = ?');
            params.push(filters.branchId);
        }

        const joinClause = joinClauses.length ? `AND ${joinClauses.join(' AND ')}` : '';

        const sql = `
            WITH account_totals AS (
            SELECT 
                a.id,
                a.code, 
                a.name, 
                a.type, 
                COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.debit ELSE 0 END), 0) as total_debit, 
                COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.credit ELSE 0 END), 0) as total_credit,
                COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.debit ELSE 0 END), 0) -
                    COALESCE(SUM(CASE WHEN je.id IS NOT NULL THEN jl.credit ELSE 0 END), 0) as net_balance
            FROM accounts a
            LEFT JOIN journal_lines jl ON a.id = jl.account_id
            LEFT JOIN journal_entries je ON jl.entry_id = je.id ${joinClause}
            WHERE a.is_active = 1
            GROUP BY a.id
            )
            SELECT
                *,
                CASE
                    WHEN type IN ('ASSET', 'EXPENSE') THEN 'DEBIT'
                    ELSE 'CREDIT'
                END as normal_side,
                CASE
                    WHEN type IN ('ASSET', 'EXPENSE') THEN net_balance
                    ELSE -net_balance
                END as signed_balance,
                CASE
                    WHEN net_balance > 0 THEN net_balance
                    ELSE 0
                END as debit_balance,
                CASE
                    WHEN net_balance < 0 THEN ABS(net_balance)
                    ELSE 0
                END as credit_balance
            FROM account_totals
            ORDER BY code
        `;

        const items = this.db.prepare(sql).all(...params) as any[];
        const totals = items.reduce(
            (acc, row) => ({
                total_debit: acc.total_debit + (row.total_debit || 0),
                total_credit: acc.total_credit + (row.total_credit || 0),
                debit_balance: acc.debit_balance + (row.debit_balance || 0),
                credit_balance: acc.credit_balance + (row.credit_balance || 0),
                signed_balance: acc.signed_balance + (row.signed_balance || 0),
                net_balance: acc.net_balance + (row.net_balance || 0)
            }),
            { total_debit: 0, total_credit: 0, debit_balance: 0, credit_balance: 0, signed_balance: 0, net_balance: 0 }
        );

        return { items, totals };
    }

    getLedgerReport(filters: {
        accountId: number;
        startDate?: string;
        endDate?: string;
        branchId?: number;
        sourceType?: string;
        partyType?: string;
        partyId?: number;
    }) {
        const account = this.db.prepare('SELECT id, code, name, type, party_type, party_id FROM accounts WHERE id = ?').get(filters.accountId) as any;
        if (!account) {
            throw new Error('Account not found');
        }
        if (filters.partyType && String(account.party_type || '').toUpperCase() !== String(filters.partyType).toUpperCase()) {
            throw new Error('Account does not belong to the requested party type');
        }
        if (filters.partyId !== undefined && Number(account.party_id) !== filters.partyId) {
            throw new Error('Account does not belong to the requested party');
        }

        const params: any[] = [filters.accountId];
        const clauses: string[] = ['je.posted = 1', 'jl.account_id = ?'];

        if (filters.startDate) {
            clauses.push('je.date >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            clauses.push('je.date <= ?');
            params.push(filters.endDate);
        }
        if (filters.sourceType) {
            clauses.push('je.source_type = ?');
            params.push(filters.sourceType);
        }
        if (filters.branchId !== undefined) {
            clauses.push('je.branch_id = ?');
            params.push(filters.branchId);
        }

        let openingBalance = 0;
        if (filters.startDate) {
            const openingClauses = ['je.posted = 1', 'jl.account_id = ?', 'je.date < ?'];
            const openingParams: any[] = [filters.accountId, filters.startDate];
            if (filters.sourceType) {
                openingClauses.push('je.source_type = ?');
                openingParams.push(filters.sourceType);
            }
            if (filters.branchId !== undefined) {
                openingClauses.push('je.branch_id = ?');
                openingParams.push(filters.branchId);
            }

            const openingRow = this.db.prepare(`
                SELECT COALESCE(SUM(jl.debit - jl.credit), 0) as balance
                FROM journal_lines jl
                JOIN journal_entries je ON jl.entry_id = je.id
                WHERE ${openingClauses.join(' AND ')}
            `).get(...openingParams) as { balance: number } | undefined;
            openingBalance = openingRow?.balance || 0;
        }

        const rows = this.db.prepare(`
            SELECT 
                je.id as entry_id,
                je.date,
                je.description as entry_description,
                je.source_type,
                je.source_id,
                jl.debit,
                jl.credit,
                jl.description as line_description
            FROM journal_lines jl
            JOIN journal_entries je ON jl.entry_id = je.id
            WHERE ${clauses.join(' AND ')}
            ORDER BY je.date ASC, je.created_at ASC, jl.id ASC
        `).all(...params) as any[];

        let runningBalance = openingBalance;
        let totalDebit = 0;
        let totalCredit = 0;
        const items = rows.map(row => {
            totalDebit += row.debit || 0;
            totalCredit += row.credit || 0;
            runningBalance += (row.debit || 0) - (row.credit || 0);
            return {
                ...row,
                running_balance: runningBalance
            };
        });

        return {
            account,
            openingBalance,
            closingBalance: runningBalance,
            totalDebit,
            totalCredit,
            items
        };
    }

    getJournalEntries(): JournalEntry[] {
        const entries = this.db.prepare('SELECT * FROM journal_entries ORDER BY created_at DESC').all() as any[];
        const linesFn = this.db.prepare('SELECT * FROM journal_lines WHERE entry_id = ?');

        return entries.map(e => ({
            ...e,
            lines: linesFn.all(e.id),
            posted: Boolean(e.posted)
        }));
    }
}

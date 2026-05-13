import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0023',
    name: 'supplier_accounting_integration',
    up(db: Database): void {
        // 1. Update suppliers table
        ensureColumn(db, 'suppliers', 'payable_account_id', 'INTEGER REFERENCES accounts(id)');
        ensureColumn(db, 'suppliers', 'advance_account_id', 'INTEGER REFERENCES accounts(id)');
        ensureColumn(db, 'suppliers', 'currency_code', "TEXT DEFAULT 'SYP'");
        ensureColumn(db, 'suppliers', 'payment_terms_days', 'INTEGER DEFAULT 0');
        ensureColumn(db, 'suppliers', 'opening_balance', 'REAL DEFAULT 0');

        // 2. Update accounts table
        ensureColumn(db, 'accounts', 'is_control', 'BOOLEAN DEFAULT 0');
        ensureColumn(db, 'accounts', 'party_type', 'TEXT'); // 'SUPPLIER', 'CUSTOMER', etc.
        ensureColumn(db, 'accounts', 'party_id', 'INTEGER');
        ensureColumn(db, 'accounts', 'system_role', 'TEXT'); // 'VAT_INPUT', 'VAT_OUTPUT', 'COGS', etc.

        // 3. Ensure Control Accounts exist (idempotent)
        const controlAccounts = [
            { code: '1000', name: 'Assets', type: 'ASSET', is_control: 1 },
            { code: '1100', name: 'Current Assets', type: 'ASSET', parent_code: '1000', is_control: 1 },
            { code: '1200', name: 'Inventory', type: 'ASSET', parent_code: '1100', system_role: 'INVENTORY' },
            { code: '1150', name: 'VAT Input', type: 'ASSET', parent_code: '1100', system_role: 'VAT_INPUT' },
            { code: '1160', name: 'Supplier Advances', type: 'ASSET', parent_code: '1100', is_control: 1 },
            { code: '2000', name: 'Liabilities', type: 'LIABILITY', is_control: 1 },
            { code: '2100', name: 'Current Liabilities', type: 'LIABILITY', parent_code: '2000', is_control: 1 },
            { code: '2110', name: 'Accounts Payable - Control', type: 'LIABILITY', parent_code: '2100', is_control: 1, system_role: 'AP_CONTROL' },
            { code: '2120', name: 'VAT Output', type: 'LIABILITY', parent_code: '2100', system_role: 'VAT_OUTPUT' },
            { code: '4000', name: 'Revenue', type: 'REVENUE', is_control: 1 },
            { code: '4100', name: 'Sales Revenue', type: 'REVENUE', parent_code: '4000', system_role: 'SALES_REVENUE' },
            { code: '5000', name: 'Expenses', type: 'EXPENSE', is_control: 1 },
            { code: '5100', name: 'Cost of Goods Sold', type: 'EXPENSE', parent_code: '5000', system_role: 'COGS' },
        ];

        for (const acc of controlAccounts) {
            const existing = db.prepare('SELECT id FROM accounts WHERE code = ?').get(acc.code) as { id: number } | undefined;
            if (!existing) {
                let parentId: number | null = null;
                if (acc.parent_code) {
                    const parent = db.prepare('SELECT id FROM accounts WHERE code = ?').get(acc.parent_code) as { id: number } | undefined;
                    parentId = parent?.id ?? null;
                }
                db.prepare(`
                    INSERT INTO accounts (code, name, type, parent_id, is_control, system_role, is_system)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `).run(acc.code, acc.name, acc.type, parentId, acc.is_control ?? 0, acc.system_role ?? null);
            } else {
                db.prepare(`
                    UPDATE accounts SET is_control = COALESCE(is_control, ?), system_role = COALESCE(system_role, ?)
                    WHERE id = ?
                `).run(acc.is_control ?? 0, acc.system_role ?? null, existing.id);
            }
        }

        // 4. Backfill existing suppliers
        const suppliers = db.prepare('SELECT id, name FROM suppliers WHERE payable_account_id IS NULL').all() as { id: number, name: string }[];
        
        const apControl = db.prepare("SELECT id FROM accounts WHERE code = '2110'").get() as { id: number } | undefined;
        const advControl = db.prepare("SELECT id FROM accounts WHERE code = '1160'").get() as { id: number } | undefined;

        if (apControl && advControl) {
            for (const s of suppliers) {
                // Generate next code for AP
                const lastAp = db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '2110.%' ORDER BY code DESC LIMIT 1").get(apControl.id) as { code: string } | undefined;
                let nextApCode = '2110.0001';
                if (lastAp) {
                    const parts = lastAp.code.split('.');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1]) + 1;
                        nextApCode = `2110.${num.toString().padStart(4, '0')}`;
                    }
                }

                const apId = db.prepare(`
                    INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                    VALUES (?, ?, 'LIABILITY', ?, 'SUPPLIER', ?, 1)
                `).run(nextApCode, `ذمم دائنة - ${s.name}`, apControl.id, s.id).lastInsertRowid;

                // Generate next code for Advances
                const lastAdv = db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '1160.%' ORDER BY code DESC LIMIT 1").get(advControl.id) as { code: string } | undefined;
                let nextAdvCode = '1160.0001';
                if (lastAdv) {
                    const parts = lastAdv.code.split('.');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1]) + 1;
                        nextAdvCode = `1160.${num.toString().padStart(4, '0')}`;
                    }
                }

                const advId = db.prepare(`
                    INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                    VALUES (?, ?, 'ASSET', ?, 'SUPPLIER', ?, 1)
                `).run(nextAdvCode, `دفعات مقدمة للمورد - ${s.name}`, advControl.id, s.id).lastInsertRowid;

                db.prepare('UPDATE suppliers SET payable_account_id = ?, advance_account_id = ? WHERE id = ?')
                    .run(apId, advId, s.id);
            }
        }
    }
};

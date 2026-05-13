import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0025',
    name: 'customer_accounting_integration',
    up(db: Database): void {
        // 1. Update customers table
        ensureColumn(db, 'customers', 'receivable_account_id', 'INTEGER REFERENCES accounts(id)');
        ensureColumn(db, 'customers', 'advance_account_id', 'INTEGER REFERENCES accounts(id)');
        ensureColumn(db, 'customers', 'currency_code', "TEXT DEFAULT 'SYP'");
        ensureColumn(db, 'customers', 'opening_balance', 'REAL DEFAULT 0');

        // 2. Ensure Control Accounts exist
        const controlAccounts = [
            { code: '1110', name: 'Accounts Receivable - Control', type: 'ASSET', parent_code: '1100', is_control: 1, system_role: 'AR_CONTROL' },
            { code: '2130', name: 'Customer Advances', type: 'LIABILITY', parent_code: '2100', is_control: 1 },
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
            }
        }

        // 3. Backfill existing customers
        const customers = db.prepare('SELECT id, name FROM customers WHERE receivable_account_id IS NULL').all() as { id: number, name: string }[];
        
        const arControl = db.prepare("SELECT id FROM accounts WHERE code = '1110'").get() as { id: number } | undefined;
        const advControl = db.prepare("SELECT id FROM accounts WHERE code = '2130'").get() as { id: number } | undefined;

        if (arControl && advControl) {
            for (const c of customers) {
                // Generate next code for AR
                const lastAr = db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '1110.%' ORDER BY code DESC LIMIT 1").get(arControl.id) as { code: string } | undefined;
                let nextArCode = '1110.0001';
                if (lastAr) {
                    const parts = lastAr.code.split('.');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1]) + 1;
                        nextArCode = `1110.${num.toString().padStart(4, '0')}`;
                    }
                }

                const arId = db.prepare(`
                    INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                    VALUES (?, ?, 'ASSET', ?, 'CUSTOMER', ?, 1)
                `).run(nextArCode, `ذمم مدينة - ${c.name}`, arControl.id, c.id).lastInsertRowid;

                // Generate next code for Advances
                const lastAdv = db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '2130.%' ORDER BY code DESC LIMIT 1").get(advControl.id) as { code: string } | undefined;
                let nextAdvCode = '2130.0001';
                if (lastAdv) {
                    const parts = lastAdv.code.split('.');
                    if (parts.length > 1) {
                        const num = parseInt(parts[1]) + 1;
                        nextAdvCode = `2130.${num.toString().padStart(4, '0')}`;
                    }
                }

                const advId = db.prepare(`
                    INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                    VALUES (?, ?, 'LIABILITY', ?, 'CUSTOMER', ?, 1)
                `).run(nextAdvCode, `دفعات مقدمة من الزبون - ${c.name}`, advControl.id, c.id).lastInsertRowid;

                db.prepare('UPDATE customers SET receivable_account_id = ?, advance_account_id = ? WHERE id = ?')
                    .run(arId, advId, c.id);
            }
        }
    },
    down(db: Database): void {
        // Soft down
    }
};

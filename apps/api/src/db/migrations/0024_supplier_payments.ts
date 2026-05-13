import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0024',
    name: 'supplier_payments',
    up(db: Database): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS supplier_payments (
                id TEXT PRIMARY KEY,
                supplier_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                account_id INTEGER NOT NULL, -- The source of funds (Cash/Bank account)
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                reference_number TEXT,
                payment_method TEXT NOT NULL, -- CASH, BANK, CHECK, etc.
                notes TEXT,
                journal_entry_id TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (account_id) REFERENCES accounts(id),
                FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
            );

            CREATE INDEX IF NOT EXISTS idx_supplier_payments_supplier ON supplier_payments(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_supplier_payments_date ON supplier_payments(date);
        `);
    },
    down(db: Database): void {
        db.exec(`DROP TABLE IF EXISTS supplier_payments;`);
    }
};

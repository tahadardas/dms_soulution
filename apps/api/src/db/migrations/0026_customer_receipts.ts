import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0026',
    name: 'customer_receipts',
    up(db: Database): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS customer_receipts (
                id TEXT PRIMARY KEY,
                customer_id INTEGER NOT NULL,
                branch_id INTEGER NOT NULL,
                account_id INTEGER NOT NULL, -- The destination (Cash/Bank account)
                amount REAL NOT NULL,
                date TEXT NOT NULL,
                reference_number TEXT,
                payment_method TEXT NOT NULL, -- CASH, BANK, CHECK, etc.
                notes TEXT,
                journal_entry_id TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (account_id) REFERENCES accounts(id),
                FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
            );

            CREATE INDEX IF NOT EXISTS idx_customer_receipts_customer ON customer_receipts(customer_id);
            CREATE INDEX IF NOT EXISTS idx_customer_receipts_date ON customer_receipts(date);
        `);
    },
    down(db: Database): void {
        db.exec(`DROP TABLE IF EXISTS customer_receipts;`);
    }
};

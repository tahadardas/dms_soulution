import type { Database } from 'better-sqlite3';
import { getColumnType, safeSqliteType } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0003',
    name: 'add_missing_operational_tables',
    up(db: Database): void {
        const branchIdType = safeSqliteType(getColumnType(db, 'branches', 'id'), 'INTEGER');
        const productIdType = safeSqliteType(getColumnType(db, 'products', 'id'), 'INTEGER');
        const orderIdType = safeSqliteType(getColumnType(db, 'orders', 'id'), 'TEXT');

        db.exec(`
            CREATE TABLE IF NOT EXISTS inventory_stock (
                branch_id ${branchIdType} NOT NULL,
                product_id ${productIdType} NOT NULL,
                quantity_on_hand REAL NOT NULL DEFAULT 0,
                average_cost REAL NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (branch_id, product_id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                order_id ${orderIdType} NOT NULL,
                method TEXT NOT NULL,
                amount REAL NOT NULL,
                currency_code TEXT NOT NULL DEFAULT 'USD',
                exchange_rate REAL NOT NULL DEFAULT 1,
                reference TEXT,
                created_by INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS fiscal_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'OPEN',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS sequences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope TEXT NOT NULL,
                sequence_date TEXT,
                branch_id ${branchIdType},
                current_value INTEGER NOT NULL DEFAULT 0,
                UNIQUE(scope, sequence_date, branch_id),
                FOREIGN KEY (branch_id) REFERENCES branches(id)
            );

            CREATE INDEX IF NOT EXISTS idx_inventory_stock_product ON inventory_stock(product_id);
            CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
            CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
            CREATE INDEX IF NOT EXISTS idx_fiscal_periods_dates ON fiscal_periods(start_date, end_date);
            CREATE INDEX IF NOT EXISTS idx_sequences_scope ON sequences(scope, sequence_date, branch_id);
        `);
    }
};

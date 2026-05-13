import type { Database } from 'better-sqlite3';
import { getColumnType, safeSqliteType } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0011',
    name: 'add_invoices',
    up(db: Database): void {
        const branchIdType = safeSqliteType(getColumnType(db, 'branches', 'id'), 'INTEGER');
        const productIdType = safeSqliteType(getColumnType(db, 'products', 'id'), 'INTEGER');
        const userIdType = safeSqliteType(getColumnType(db, 'users', 'id'), 'INTEGER');

        db.exec(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                address TEXT,
                tax_number TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS purchase_invoices (
                id TEXT PRIMARY KEY,
                supplier_id INTEGER NOT NULL,
                branch_id ${branchIdType} NOT NULL,
                invoice_number TEXT NOT NULL,
                date TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
                total_amount REAL NOT NULL DEFAULT 0,
                tax_amount REAL NOT NULL DEFAULT 0,
                notes TEXT,
                created_by ${userIdType},
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS purchase_invoice_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id TEXT NOT NULL,
                product_id ${productIdType} NOT NULL,
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                total_price REAL NOT NULL,
                tax_amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS sales_invoices (
                id TEXT PRIMARY KEY,
                customer_id INTEGER NOT NULL,
                branch_id ${branchIdType} NOT NULL,
                invoice_number TEXT NOT NULL,
                date TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
                total_amount REAL NOT NULL DEFAULT 0,
                tax_amount REAL NOT NULL DEFAULT 0,
                payment_status TEXT NOT NULL CHECK (payment_status IN ('UNPAID', 'PARTIAL', 'PAID')),
                notes TEXT,
                created_by ${userIdType},
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (customer_id) REFERENCES customers(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS sales_invoice_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                invoice_id TEXT NOT NULL,
                product_id ${productIdType} NOT NULL,
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                cost_at_time REAL NOT NULL,
                total_price REAL NOT NULL,
                tax_amount REAL NOT NULL DEFAULT 0,
                FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

            CREATE INDEX IF NOT EXISTS idx_purchase_invoices_supplier ON purchase_invoices(supplier_id);
            CREATE INDEX IF NOT EXISTS idx_purchase_invoices_date ON purchase_invoices(date);
            CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
            CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(date);
        `);
    }
};

import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

function ensureBaselineColumns(db: Database): void {
    ensureColumn(db, 'users', 'branch_id', 'INTEGER');
    ensureColumn(db, 'users', 'settings', 'TEXT');
    ensureColumn(db, 'roles', 'description', 'TEXT');
    ensureColumn(db, 'orders', 'branch_id', 'INTEGER');
    ensureColumn(db, 'orders', 'payment_method', "TEXT DEFAULT 'CASH'");
    ensureColumn(db, 'orders', 'tax_amount', 'REAL DEFAULT 0');
    ensureColumn(db, 'order_notes', 'created_by', 'INTEGER');
    ensureColumn(db, 'order_lines', 'cost_at_time', 'REAL DEFAULT 0');
    ensureColumn(db, 'order_lines', 'notes', 'TEXT');
    ensureColumn(db, 'returns', 'created_by', 'INTEGER');
    ensureColumn(db, 'accounts', 'is_active', 'BOOLEAN DEFAULT 1');
    ensureColumn(db, 'accounts', 'branch_id', 'INTEGER');
    ensureColumn(db, 'journal_entries', 'posted_at', 'TEXT');
    ensureColumn(db, 'journal_entries', 'posted_by', 'INTEGER');
    ensureColumn(db, 'journal_entries', 'branch_id', 'INTEGER');
    ensureColumn(db, 'journal_entries', 'reversed_of', 'TEXT');
    ensureColumn(db, 'products', 'description', 'TEXT');
    ensureColumn(db, 'products', 'category_id', 'INTEGER');
    ensureColumn(db, 'products', 'unit_id', 'INTEGER');
    ensureColumn(db, 'products', 'is_active', 'BOOLEAN DEFAULT 1');
    ensureColumn(db, 'products', 'created_by', 'INTEGER');
    ensureColumn(db, 'products', 'updated_by', 'INTEGER');
    ensureColumn(db, 'products', 'updated_at', 'TEXT');
    ensureColumn(db, 'recipes', 'unit_id', 'INTEGER');
    ensureColumn(db, 'recipes', 'waste_percent', 'REAL');
    ensureColumn(db, 'recipes', 'notes', 'TEXT');
    ensureColumn(db, 'recipes', 'created_by', 'INTEGER');
    ensureColumn(db, 'recipes', 'created_at', 'TEXT');
    ensureColumn(db, 'recipes', 'updated_by', 'INTEGER');
    ensureColumn(db, 'recipes', 'updated_at', 'TEXT');
    ensureColumn(db, 'inventory_movements', 'branch_id', 'INTEGER');
    ensureColumn(db, 'inventory_movements', 'reason', 'TEXT');
    ensureColumn(db, 'inventory_movements', 'created_by', 'INTEGER');
    ensureColumn(db, 'printers', 'branch_id', 'INTEGER');
    ensureColumn(db, 'printer_routes', 'scope_type', 'TEXT');
    ensureColumn(db, 'printer_routes', 'scope_value', 'TEXT');
    ensureColumn(db, 'printer_routes', 'job_type', 'TEXT');
    ensureColumn(db, 'printer_routes', 'branch_id', 'INTEGER');
    ensureColumn(db, 'printer_routes', 'template_id', 'INTEGER');
    ensureColumn(db, 'printer_routes', 'is_active', 'BOOLEAN DEFAULT 1');
    ensureColumn(db, 'print_jobs', 'payload', 'TEXT');
    ensureColumn(db, 'print_jobs', 'template_id', 'INTEGER');
    ensureColumn(db, 'print_jobs', 'retries', 'INTEGER DEFAULT 0');
    ensureColumn(db, 'print_jobs', 'last_error', 'TEXT');
    ensureColumn(db, 'print_jobs', 'last_attempt_at', 'TEXT');
    ensureColumn(db, 'print_jobs', 'updated_at', 'TEXT');
}

export const migration: Migration = {
    version: '0001',
    name: 'baseline',
    up(db: Database): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS branches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                settings TEXT
            );

            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS permissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS role_permissions (
                role_id TEXT NOT NULL,
                permission_code TEXT NOT NULL,
                PRIMARY KEY (role_id, permission_code),
                FOREIGN KEY (role_id) REFERENCES roles(id),
                FOREIGN KEY (permission_code) REFERENCES permissions(code)
            );

            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role_id TEXT NOT NULL,
                branch_id INTEGER,
                settings TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (role_id) REFERENCES roles(id)
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                version INTEGER DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                updated_at DATETIME,
                FOREIGN KEY(created_by) REFERENCES users(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS units (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                abbreviation TEXT NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                updated_at DATETIME,
                FOREIGN KEY(created_by) REFERENCES users(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS unit_conversions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_unit_id INTEGER NOT NULL,
                to_unit_id INTEGER NOT NULL,
                multiplier REAL NOT NULL,
                created_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                updated_at DATETIME,
                UNIQUE(from_unit_id, to_unit_id),
                FOREIGN KEY(from_unit_id) REFERENCES units(id),
                FOREIGN KEY(to_unit_id) REFERENCES units(id),
                FOREIGN KEY(created_by) REFERENCES users(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                parent_id INTEGER,
                is_system BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                branch_id INTEGER,
                FOREIGN KEY(parent_id) REFERENCES accounts(id)
            );

            CREATE TABLE IF NOT EXISTS journal_entries (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                description TEXT NOT NULL,
                posted BOOLEAN DEFAULT 0,
                posted_at TEXT,
                posted_by INTEGER,
                branch_id INTEGER,
                source_type TEXT NOT NULL,
                source_id TEXT,
                reversed_of TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS journal_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id TEXT NOT NULL,
                account_id INTEGER NOT NULL,
                debit REAL DEFAULT 0,
                credit REAL DEFAULT 0,
                description TEXT,
                FOREIGN KEY(entry_id) REFERENCES journal_entries(id),
                FOREIGN KEY(account_id) REFERENCES accounts(id)
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sku TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL DEFAULT 'FINISHED_GOOD',
                description TEXT,
                price REAL DEFAULT 0,
                cost REAL DEFAULT 0,
                stock_quantity REAL DEFAULT 0,
                min_stock_level REAL,
                category_id INTEGER,
                unit_id INTEGER,
                is_active BOOLEAN DEFAULT 1,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                updated_at TEXT,
                FOREIGN KEY(category_id) REFERENCES categories(id),
                FOREIGN KEY(unit_id) REFERENCES units(id),
                FOREIGN KEY(created_by) REFERENCES users(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS recipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                ingredient_id INTEGER NOT NULL,
                quantity REAL NOT NULL,
                unit_id INTEGER,
                waste_percent REAL,
                notes TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_by INTEGER,
                updated_at TEXT,
                FOREIGN KEY(product_id) REFERENCES products(id),
                FOREIGN KEY(ingredient_id) REFERENCES products(id),
                FOREIGN KEY(unit_id) REFERENCES units(id),
                FOREIGN KEY(created_by) REFERENCES users(id),
                FOREIGN KEY(updated_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS inventory_movements (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                type TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                quantity REAL NOT NULL,
                unit_cost REAL,
                reference_id TEXT,
                description TEXT,
                branch_id INTEGER,
                reason TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_id) REFERENCES products(id),
                FOREIGN KEY(branch_id) REFERENCES branches(id),
                FOREIGN KEY(created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                address TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS pos_sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                branch_id INTEGER,
                start_time TEXT NOT NULL,
                end_time TEXT,
                opening_cash REAL NOT NULL,
                closing_cash REAL,
                status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'REVIEW')),
                notes TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                customer_id INTEGER,
                branch_id INTEGER,
                order_number TEXT,
                status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'VOID', 'RETURNED')),
                total_amount REAL NOT NULL,
                tax_amount REAL DEFAULT 0,
                payment_method TEXT DEFAULT 'CASH',
                table_number TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES pos_sessions(id),
                FOREIGN KEY (customer_id) REFERENCES customers(id)
            );

            CREATE TABLE IF NOT EXISTS order_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                cost_at_time REAL DEFAULT 0,
                total_price REAL NOT NULL,
                notes TEXT,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );

            CREATE TABLE IF NOT EXISTS order_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id)
            );

            CREATE TABLE IF NOT EXISTS returns (
                id TEXT PRIMARY KEY,
                original_order_id TEXT NOT NULL,
                reason TEXT,
                total_refund REAL NOT NULL,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (original_order_id) REFERENCES orders(id)
            );

            CREATE TABLE IF NOT EXISTS return_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                return_id TEXT NOT NULL,
                order_line_id INTEGER NOT NULL,
                quantity REAL NOT NULL,
                unit_price REAL NOT NULL,
                total_price REAL NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (return_id) REFERENCES returns(id),
                FOREIGN KEY (order_line_id) REFERENCES order_lines(id)
            );

            CREATE TABLE IF NOT EXISTS printers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                branch_id INTEGER,
                type TEXT NOT NULL,
                target TEXT NOT NULL,
                ip_address TEXT,
                port INTEGER DEFAULT 9100,
                is_active BOOLEAN DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS printer_routes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scope_type TEXT NOT NULL,
                scope_value TEXT,
                job_type TEXT NOT NULL,
                branch_id INTEGER,
                printer_id INTEGER NOT NULL,
                template_id INTEGER,
                is_active BOOLEAN DEFAULT 1,
                FOREIGN KEY(printer_id) REFERENCES printers(id)
            );

            CREATE TABLE IF NOT EXISTS print_jobs (
                id TEXT PRIMARY KEY,
                printer_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT,
                payload TEXT,
                template_id INTEGER,
                retries INTEGER DEFAULT 0,
                last_error TEXT,
                last_attempt_at TEXT,
                updated_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(printer_id) REFERENCES printers(id)
            );

            CREATE TABLE IF NOT EXISTS print_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                is_default BOOLEAN DEFAULT 0,
                is_active BOOLEAN DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            );

            CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
                name,
                sku,
                content='products',
                content_rowid='id'
            );

            CREATE TABLE IF NOT EXISTS ai_insights (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPLIED', 'DISMISSED')),
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                title TEXT NOT NULL,
                explanation TEXT NOT NULL,
                suggested_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TEXT,
                reviewed_by INTEGER,
                FOREIGN KEY(reviewed_by) REFERENCES users(id)
            );
        `);

        ensureBaselineColumns(db);

        db.exec(`
            CREATE TRIGGER IF NOT EXISTS products_ai AFTER INSERT ON products BEGIN
                INSERT INTO products_fts(rowid, name, sku) VALUES (new.id, new.name, new.sku);
            END;

            CREATE TRIGGER IF NOT EXISTS products_ad AFTER DELETE ON products BEGIN
                INSERT INTO products_fts(products_fts, rowid, name, sku) VALUES('delete', old.id, old.name, old.sku);
            END;

            CREATE TRIGGER IF NOT EXISTS products_au AFTER UPDATE ON products BEGIN
                INSERT INTO products_fts(products_fts, rowid, name, sku) VALUES('delete', old.id, old.name, old.sku);
                INSERT INTO products_fts(rowid, name, sku) VALUES (new.id, new.name, new.sku);
            END;

            CREATE TRIGGER IF NOT EXISTS prevent_journal_update
            BEFORE UPDATE ON journal_entries
            WHEN OLD.posted = 1
            BEGIN
                SELECT RAISE(ABORT, 'Posted journal entries cannot be modified');
            END;

            CREATE TRIGGER IF NOT EXISTS prevent_journal_delete
            BEFORE DELETE ON journal_entries
            WHEN OLD.posted = 1
            BEGIN
                SELECT RAISE(ABORT, 'Posted journal entries cannot be deleted');
            END;

            CREATE TRIGGER IF NOT EXISTS check_journal_balance
            BEFORE UPDATE OF posted ON journal_entries
            WHEN NEW.posted = 1
            BEGIN
                SELECT RAISE(ABORT, 'Journal entry does not balance')
                WHERE (
                    SELECT ABS(TOTAL(debit) - TOTAL(credit))
                    FROM journal_lines
                    WHERE entry_id = NEW.id
                ) > 0.001;
            END;

            CREATE TRIGGER IF NOT EXISTS prevent_inventory_update
            BEFORE UPDATE ON inventory_movements
            BEGIN
                SELECT RAISE(ABORT, 'Inventory movements are immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS prevent_inventory_delete
            BEFORE DELETE ON inventory_movements
            BEGIN
                SELECT RAISE(ABORT, 'Inventory movements are immutable');
            END;
        `);

        db.prepare('UPDATE products SET is_active = 1 WHERE is_active IS NULL').run();
        db.prepare('UPDATE accounts SET is_active = 1 WHERE is_active IS NULL').run();
    }
};

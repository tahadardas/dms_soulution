import type { Database } from 'better-sqlite3';
import { ensureColumn, columnExists } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0005',
    name: 'add_delivery_support',
    up(db: Database): void {
        // Disable FK checks to allow dropping and recreating orders table
        db.exec('PRAGMA foreign_keys = OFF');

        try {
            // 1. Check if orders table already supports PENDING_DELIVERY
            const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get() as { sql: string } | undefined;
            const hasNewStatus = tableInfo?.sql?.includes('PENDING_DELIVERY') || false;

            if (!hasNewStatus) {
                // 2. Recreate orders table with updated CHECK constraint and all new columns
                db.exec(`
                    CREATE TABLE IF NOT EXISTS orders_new (
                        id TEXT PRIMARY KEY,
                        session_id TEXT NOT NULL,
                        customer_id INTEGER,
                        branch_id INTEGER,
                        order_number TEXT,
                        status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'VOID', 'RETURNED', 'PENDING_DELIVERY')),
                        total_amount REAL NOT NULL,
                        tax_amount REAL DEFAULT 0,
                        payment_method TEXT DEFAULT 'CASH',
                        table_number TEXT,
                        order_type TEXT DEFAULT 'DINE_IN',
                        payment_status TEXT DEFAULT 'PAID',
                        delivery_status TEXT,
                        collected_at TEXT,
                        collected_by INTEGER,
                        delivery_person_name TEXT,
                        delivery_phone TEXT,
                        delivery_address TEXT,
                        delivery_notes TEXT,
                        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (session_id) REFERENCES pos_sessions(id),
                        FOREIGN KEY (customer_id) REFERENCES customers(id)
                    );
                `);

                // Copy data from old table
                const oldCols = db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
                const oldColNames = oldCols.map(c => c.name);
                
                const newColNames = [
                    'id', 'session_id', 'customer_id', 'branch_id', 'order_number',
                    'status', 'total_amount', 'tax_amount', 'payment_method', 'table_number',
                    'order_type', 'payment_status', 'delivery_status', 'collected_at',
                    'collected_by', 'delivery_person_name', 'delivery_phone',
                    'delivery_address', 'delivery_notes', 'created_at'
                ];

                const commonCols = oldColNames.filter(c => newColNames.includes(c));
                const colList = commonCols.join(', ');

                db.exec(`INSERT INTO orders_new (${colList}) SELECT ${colList} FROM orders`);
                db.exec('DROP TABLE orders');
                db.exec('ALTER TABLE orders_new RENAME TO orders');
            } else {
                // If table already has the status but maybe missing some columns (incremental fix)
                ensureColumn(db, 'orders', 'order_type', "TEXT DEFAULT 'DINE_IN'");
                ensureColumn(db, 'orders', 'payment_status', "TEXT DEFAULT 'PAID'");
                ensureColumn(db, 'orders', 'delivery_status', 'TEXT');
                ensureColumn(db, 'orders', 'collected_at', 'TEXT');
                ensureColumn(db, 'orders', 'collected_by', 'INTEGER');
                ensureColumn(db, 'orders', 'delivery_person_name', 'TEXT');
                ensureColumn(db, 'orders', 'delivery_phone', 'TEXT');
                ensureColumn(db, 'orders', 'delivery_address', 'TEXT');
                ensureColumn(db, 'orders', 'delivery_notes', 'TEXT');
            }

            // 3. Set payment_status for existing orders
            db.prepare("UPDATE orders SET payment_status = 'PAID' WHERE payment_status IS NULL AND status = 'COMPLETED'").run();
            db.prepare("UPDATE orders SET payment_status = 'REFUNDED' WHERE payment_status IS NULL AND status = 'RETURNED'").run();
            db.prepare("UPDATE orders SET order_type = 'DINE_IN' WHERE order_type IS NULL").run();

            // 4. Create indexes for delivery queries
            db.exec(`
                CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
                CREATE INDEX IF NOT EXISTS idx_orders_order_type ON orders(order_type);
                CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON orders(delivery_status);
                CREATE INDEX IF NOT EXISTS idx_orders_status_payment ON orders(status, payment_status);
            `);
        } finally {
            db.exec('PRAGMA foreign_keys = ON');
        }
    }
};

import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0012',
    name: 'payments_session_and_type',
    up(db: Database): void {
        ensureColumn(db, 'payments', 'session_id', 'TEXT');
        ensureColumn(db, 'payments', 'type', "TEXT NOT NULL DEFAULT 'PAYMENT'");
        ensureColumn(db, 'payments', 'notes', 'TEXT');

        db.exec(`
            UPDATE payments
            SET session_id = (
                SELECT session_id
                FROM orders
                WHERE orders.id = payments.order_id
            )
            WHERE session_id IS NULL
              AND order_id IS NOT NULL;

            CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id);
            CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(type);
            CREATE INDEX IF NOT EXISTS idx_payments_method_status ON payments(method, status);
        `);
    }
};


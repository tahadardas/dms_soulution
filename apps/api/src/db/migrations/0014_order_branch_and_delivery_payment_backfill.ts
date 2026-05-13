import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0014',
    name: 'order_branch_and_delivery_payment_backfill',
    up(db: Database): void {
        db.exec(`
            UPDATE orders
            SET branch_id = (
                SELECT branch_id
                FROM pos_sessions
                WHERE pos_sessions.id = orders.session_id
            )
            WHERE branch_id IS NULL
              AND EXISTS (
                  SELECT 1
                  FROM pos_sessions
                  WHERE pos_sessions.id = orders.session_id
                    AND pos_sessions.branch_id IS NOT NULL
              );

            UPDATE orders
            SET payment_method = (
                SELECT p.method
                FROM payments p
                WHERE p.order_id = orders.id
                  AND p.type = 'DELIVERY_COLLECTION'
                  AND p.status = 'COMPLETED'
                ORDER BY p.created_at DESC, p.id DESC
                LIMIT 1
            )
            WHERE EXISTS (
                SELECT 1
                FROM payments p
                WHERE p.order_id = orders.id
                  AND p.type = 'DELIVERY_COLLECTION'
                  AND p.status = 'COMPLETED'
            );

            CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);
        `);
    }
};

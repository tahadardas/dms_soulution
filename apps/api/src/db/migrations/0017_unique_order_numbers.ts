import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0017',
    name: 'unique_order_numbers',
    up(db: Database): void {
        const duplicates = db.prepare(`
            SELECT order_number, COUNT(*) as count
            FROM orders
            WHERE order_number IS NOT NULL
            GROUP BY order_number
            HAVING COUNT(*) > 1
            LIMIT 5
        `).all() as Array<{ order_number: string; count: number }>;

        if (duplicates.length > 0) {
            const duplicateList = duplicates.map(row => `${row.order_number} (${row.count})`).join(', ');
            throw new Error(`Cannot enforce unique order numbers while duplicates exist: ${duplicateList}`);
        }

        db.exec(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number_unique
            ON orders(order_number)
            WHERE order_number IS NOT NULL;
        `);
    }
};

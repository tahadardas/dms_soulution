import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0007',
    name: 'add_discounts',
    up(db: Database): void {
        db.exec(`
            ALTER TABLE orders ADD COLUMN discount_amount REAL DEFAULT 0;
            ALTER TABLE orders ADD COLUMN discount_type TEXT DEFAULT 'PERCENTAGE';
            ALTER TABLE orders ADD COLUMN service_charge REAL DEFAULT 0;
            ALTER TABLE orders ADD COLUMN tips_amount REAL DEFAULT 0;
        `);
    },
    down(db: Database): void {
        try {
            db.exec(`
                ALTER TABLE orders DROP COLUMN discount_amount;
                ALTER TABLE orders DROP COLUMN discount_type;
                ALTER TABLE orders DROP COLUMN service_charge;
                ALTER TABLE orders DROP COLUMN tips_amount;
            `);
        } catch (e) {
            console.warn('Could not drop columns on downgrade, sqlite version might not support it.', e);
        }
    }
};

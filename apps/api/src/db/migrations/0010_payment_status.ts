import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0010',
    name: 'payment_status',
    up(db: Database): void {
        ensureColumn(db, 'payments', 'status', "TEXT DEFAULT 'COMPLETED'");
    }
};

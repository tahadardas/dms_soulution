import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0006',
    name: 'add_category_color',
    up(db: Database): void {
        ensureColumn(db, 'categories', 'color', 'TEXT');
    }
};

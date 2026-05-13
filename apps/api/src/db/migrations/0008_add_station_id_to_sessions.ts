import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0008',
    name: 'add_station_id_to_sessions',
    up(db: Database): void {
        ensureColumn(db, 'pos_sessions', 'station_id', 'TEXT');
    },
    down(db: Database): void {
        try {
            db.prepare('UPDATE pos_sessions SET station_id = NULL').run();
        } catch (e) {
            console.warn('Could not clear station_id values', e);
        }
    }
};
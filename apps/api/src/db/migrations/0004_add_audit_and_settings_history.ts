import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0004',
    name: 'add_audit_and_settings_history',
    up(db: Database): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                branch_id INTEGER,
                device_id TEXT,
                details TEXT,
                entity_type TEXT,
                entity_id TEXT,
                old_value TEXT,
                new_value TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS settings_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                version INTEGER NOT NULL,
                setting_key TEXT,
                old_value TEXT,
                new_value TEXT,
                changed_by INTEGER,
                changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (changed_by) REFERENCES users(id)
            );
        `);

        ensureColumn(db, 'audit_logs', 'branch_id', 'INTEGER');
        ensureColumn(db, 'audit_logs', 'device_id', 'TEXT');
        ensureColumn(db, 'audit_logs', 'details', 'TEXT');
        ensureColumn(db, 'audit_logs', 'entity_type', 'TEXT');
        ensureColumn(db, 'audit_logs', 'entity_id', 'TEXT');
        ensureColumn(db, 'audit_logs', 'old_value', 'TEXT');
        ensureColumn(db, 'audit_logs', 'new_value', 'TEXT');
        ensureColumn(db, 'audit_logs', 'ip_address', 'TEXT');
        ensureColumn(db, 'audit_logs', 'user_agent', 'TEXT');

        ensureColumn(db, 'settings_history', 'key', 'TEXT');
        ensureColumn(db, 'settings_history', 'value', 'TEXT');
        ensureColumn(db, 'settings_history', 'version', 'INTEGER DEFAULT 1');
        ensureColumn(db, 'settings_history', 'setting_key', 'TEXT');
        ensureColumn(db, 'settings_history', 'old_value', 'TEXT');
        ensureColumn(db, 'settings_history', 'new_value', 'TEXT');
        ensureColumn(db, 'settings_history', 'changed_by', 'INTEGER');
        ensureColumn(db, 'settings_history', 'changed_at', 'TEXT');

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
            CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
            CREATE INDEX IF NOT EXISTS idx_settings_history_key ON settings_history(key);
            CREATE INDEX IF NOT EXISTS idx_settings_history_setting_key ON settings_history(setting_key);
            CREATE INDEX IF NOT EXISTS idx_settings_history_changed_at ON settings_history(changed_at);
        `);
    }
};

import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0015',
    name: 'printing_jobs_and_workstations',
    up(db: Database): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS workstations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                device_key TEXT NOT NULL UNIQUE,
                branch_id INTEGER,
                is_active INTEGER NOT NULL DEFAULT 1,
                last_seen_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (branch_id) REFERENCES branches(id)
            );

            CREATE INDEX IF NOT EXISTS idx_workstations_device_key ON workstations(device_key);
            CREATE INDEX IF NOT EXISTS idx_workstations_branch ON workstations(branch_id);
        `);

        ensureColumn(db, 'printers', 'display_name', 'TEXT');
        ensureColumn(db, 'printers', 'windows_printer_name', 'TEXT');
        ensureColumn(db, 'printers', 'device_id', 'TEXT');
        ensureColumn(db, 'printers', 'paper_width', 'INTEGER DEFAULT 80');
        ensureColumn(db, 'printers', 'last_seen_at', 'TEXT');

        ensureColumn(db, 'printer_routes', 'category_id', 'INTEGER');
        ensureColumn(db, 'printer_routes', 'is_default', 'BOOLEAN DEFAULT 0');

        ensureColumn(db, 'print_jobs', 'attempts', 'INTEGER DEFAULT 0');
        ensureColumn(db, 'print_jobs', 'device_id', 'TEXT');
        ensureColumn(db, 'print_jobs', 'locked_by', 'TEXT');
        ensureColumn(db, 'print_jobs', 'locked_at', 'TEXT');
        ensureColumn(db, 'print_jobs', 'processed_at', 'TEXT');
        ensureColumn(db, 'print_jobs', 'error_message', 'TEXT');
        ensureColumn(db, 'print_jobs', 'retry_count', 'INTEGER DEFAULT 0');

        db.exec(`
            UPDATE print_jobs
            SET status = CASE
                WHEN status IN ('COMPLETED', 'DONE') THEN 'SUCCESS'
                WHEN status = 'PROCESSING' THEN 'PENDING'
                ELSE status
            END;

            UPDATE print_jobs
            SET attempts = COALESCE(NULLIF(attempts, 0), retries, retry_count, 0),
                retry_count = COALESCE(NULLIF(retry_count, 0), retries, attempts, 0),
                error_message = COALESCE(error_message, last_error);

            CREATE INDEX IF NOT EXISTS idx_print_jobs_status_type ON print_jobs(status, type);
            CREATE INDEX IF NOT EXISTS idx_print_jobs_device_status ON print_jobs(device_id, status);
            CREATE INDEX IF NOT EXISTS idx_print_jobs_locked_by ON print_jobs(locked_by);
            CREATE INDEX IF NOT EXISTS idx_printers_device_id ON printers(device_id);
            CREATE INDEX IF NOT EXISTS idx_printers_type_device ON printers(type, device_id);
        `);
    }
};

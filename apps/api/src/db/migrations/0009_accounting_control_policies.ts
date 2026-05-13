import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0009',
    name: 'accounting_control_policies',
    up(db: Database): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS manager_approvals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id TEXT,
                requested_by INTEGER NOT NULL,
                approved_by INTEGER NOT NULL,
                reason TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (requested_by) REFERENCES users(id),
                FOREIGN KEY (approved_by) REFERENCES users(id)
            );
            CREATE INDEX IF NOT EXISTS idx_manager_approvals_action ON manager_approvals(action);
            CREATE INDEX IF NOT EXISTS idx_manager_approvals_entity ON manager_approvals(entity_type, entity_id);
        `);

        // pos_sessions additions
        ensureColumn(db, 'pos_sessions', 'expected_cash', 'REAL DEFAULT 0');
        ensureColumn(db, 'pos_sessions', 'actual_cash', 'REAL DEFAULT NULL');
        ensureColumn(db, 'pos_sessions', 'cash_difference', 'REAL DEFAULT 0');
        ensureColumn(db, 'pos_sessions', 'cash_difference_reason', 'TEXT DEFAULT NULL');
        ensureColumn(db, 'pos_sessions', 'closed_by', 'INTEGER DEFAULT NULL');
        ensureColumn(db, 'pos_sessions', 'close_approved_by', 'INTEGER DEFAULT NULL');
        ensureColumn(db, 'pos_sessions', 'close_approval_reason', 'TEXT DEFAULT NULL');

        // audit_logs additions
        ensureColumn(db, 'audit_logs', 'reason', 'TEXT');
        ensureColumn(db, 'audit_logs', 'approved_by', 'INTEGER');

        // orders additions
        ensureColumn(db, 'orders', 'void_reason', 'TEXT DEFAULT NULL');
        ensureColumn(db, 'orders', 'voided_by', 'INTEGER DEFAULT NULL');
        ensureColumn(db, 'orders', 'voided_at', 'TEXT DEFAULT NULL');
        ensureColumn(db, 'orders', 'void_approved_by', 'INTEGER DEFAULT NULL');
        ensureColumn(db, 'orders', 'discount_reason', 'TEXT DEFAULT NULL');
        ensureColumn(db, 'orders', 'discount_approved_by', 'INTEGER DEFAULT NULL');
        ensureColumn(db, 'orders', 'reprint_count', 'INTEGER DEFAULT 0');

        // returns additions
        ensureColumn(db, 'returns', 'approved_by', 'INTEGER DEFAULT NULL');
    }
};

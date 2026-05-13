import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0019',
    name: 'cash_movements',
    up(db: Database): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS cash_movements (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                branch_id INTEGER,
                type TEXT NOT NULL CHECK (type IN ('CASH_IN', 'CASH_OUT')),
                method TEXT NOT NULL DEFAULT 'CASH',
                amount REAL NOT NULL CHECK (amount > 0),
                reason TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'COMPLETED',
                approved_by INTEGER,
                created_by INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES pos_sessions(id),
                FOREIGN KEY (branch_id) REFERENCES branches(id),
                FOREIGN KEY (approved_by) REFERENCES users(id),
                FOREIGN KEY (created_by) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);
            CREATE INDEX IF NOT EXISTS idx_cash_movements_type_status ON cash_movements(type, status);
            CREATE INDEX IF NOT EXISTS idx_cash_movements_created_at ON cash_movements(created_at);
        `);
    }
};

import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

const PERMISSIONS = [
    { code: 'POS.CashIn', description: 'Record POS cash in movements' },
    { code: 'POS.CashOut', description: 'Record POS cash out movements' }
];

export const migration: Migration = {
    version: '0020',
    name: 'pos_cash_movement_permissions',
    up(db: Database): void {
        const insertPermission = db.prepare(`
            INSERT OR IGNORE INTO permissions (code, description)
            VALUES (?, ?)
        `);

        for (const permission of PERMISSIONS) {
            insertPermission.run(permission.code, permission.description);
        }

        db.prepare(`
            INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
            SELECT id, 'POS.CashIn'
            FROM roles
            WHERE id IN ('admin', 'supervisor')
        `).run();

        db.prepare(`
            INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
            SELECT id, 'POS.CashOut'
            FROM roles
            WHERE id IN ('admin', 'supervisor')
        `).run();
    }
};

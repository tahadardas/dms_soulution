import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

const PRINT_PERMISSIONS = [
    { code: 'POS.OrderPrint', description: 'Print saved POS orders' },
    { code: 'POS.OrderReprint', description: 'Reprint saved POS orders' }
];

export const migration: Migration = {
    version: '0016',
    name: 'pos_print_permissions',
    up(db: Database): void {
        const insertPermission = db.prepare(`
            INSERT OR IGNORE INTO permissions (code, description)
            VALUES (?, ?)
        `);
        for (const permission of PRINT_PERMISSIONS) {
            insertPermission.run(permission.code, permission.description);
        }

        db.prepare(`
            INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
            SELECT id, 'POS.OrderPrint'
            FROM roles
            WHERE id IN ('admin', 'cashier', 'supervisor')
        `).run();

        db.prepare(`
            INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
            SELECT id, 'POS.OrderReprint'
            FROM roles
            WHERE id IN ('admin', 'supervisor')
        `).run();
    }
};

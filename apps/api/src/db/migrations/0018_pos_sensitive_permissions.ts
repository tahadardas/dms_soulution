import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

const PERMISSIONS = [
    { code: 'POS.OrderVoid', description: 'Void POS orders' },
    { code: 'POS.ReturnCreate', description: 'Create POS returns' },
    { code: 'POS.DeliveryCollect', description: 'Collect pending delivery orders' }
];

export const migration: Migration = {
    version: '0018',
    name: 'pos_sensitive_permissions',
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
            SELECT id, 'POS.DeliveryCollect'
            FROM roles
            WHERE id IN ('admin', 'cashier', 'supervisor')
        `).run();

        db.prepare(`
            INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
            SELECT id, 'POS.ReturnCreate'
            FROM roles
            WHERE id IN ('admin', 'supervisor')
        `).run();

        db.prepare(`
            INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
            SELECT id, 'POS.OrderVoid'
            FROM roles
            WHERE id IN ('admin', 'supervisor')
        `).run();
    }
};

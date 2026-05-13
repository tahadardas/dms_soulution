import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0021',
    name: 'manager_approval_permissions',
    up(db: Database): void {
        const approvalPermissions = [
            { code: 'MANAGER.Approval', description: 'General manager approval authority' },
            { code: 'POS.SessionCloseApprove', description: 'Approve session close with cash difference or pending delivery' },
            { code: 'POS.ReturnApprove', description: 'Approve return orders requiring manager approval' },
            { code: 'POS.OrderVoidApprove', description: 'Approve voiding paid/printed orders' },
            { code: 'POS.ReprintApprove', description: 'Approve reprinting receipts' },
            { code: 'POS.DiscountApprove', description: 'Approve discounts exceeding cashier limits' },
            { code: 'POS.CashOutApprove', description: 'Approve large cash out operations' }
        ];

        const insertPerm = db.prepare(
            'INSERT OR IGNORE INTO permissions (code, description) VALUES (?, ?)'
        );

        for (const perm of approvalPermissions) {
            insertPerm.run(perm.code, perm.description);
        }

        // Grant all approval permissions to existing ADMIN and SUPERVISOR roles
        const insertRolePerm = db.prepare(
            'INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)'
        );

        const adminRole = db.prepare("SELECT id FROM roles WHERE id = 'ADMIN' OR name = 'Admin' LIMIT 1").get() as { id: string } | undefined;
        const supervisorRole = db.prepare("SELECT id FROM roles WHERE id = 'SUPERVISOR' OR name = 'Supervisor' LIMIT 1").get() as { id: string } | undefined;

        for (const perm of approvalPermissions) {
            if (adminRole) insertRolePerm.run(adminRole.id, perm.code);
            if (supervisorRole) insertRolePerm.run(supervisorRole.id, perm.code);
        }
    }
};

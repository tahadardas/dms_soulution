import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0022',
    name: 'add_delivery_couriers',
    up(db: Database): void {
        // 1. Create delivery_couriers table
        db.exec(`
            CREATE TABLE IF NOT EXISTS delivery_couriers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                notes TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                commission_enabled INTEGER NOT NULL DEFAULT 0,
                commission_type TEXT NOT NULL DEFAULT 'NONE',
                commission_value REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            );
        `);

        // 2. Add columns to orders table
        ensureColumn(db, 'orders', 'delivery_courier_id', 'INTEGER DEFAULT NULL');
        ensureColumn(db, 'orders', 'delivery_courier_name', 'TEXT DEFAULT NULL');
        ensureColumn(db, 'orders', 'delivery_courier_phone', 'TEXT DEFAULT NULL');
        ensureColumn(db, 'orders', 'delivery_courier_one_time', 'INTEGER NOT NULL DEFAULT 0');
        ensureColumn(db, 'orders', 'delivery_commission_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'orders', 'delivery_commission_type', "TEXT DEFAULT 'NONE'");
        ensureColumn(db, 'orders', 'delivery_commission_status', "TEXT DEFAULT 'NOT_APPLICABLE'");

        // 3. Add Permissions
        const courierPermissions = [
            { code: 'DELIVERY_COURIER_VIEW', description: 'View delivery couriers and their stats' },
            { code: 'DELIVERY_COURIER_CREATE', description: 'Create new delivery couriers' },
            { code: 'DELIVERY_COURIER_UPDATE', description: 'Update delivery courier settings and commissions' },
            { code: 'DELIVERY_COURIER_REPORT', description: 'View delivery courier performance reports' },
            { code: 'DELIVERY_COURIER_COMMISSION_PAY', description: 'Record commission payments to couriers' }
        ];

        const insertPerm = db.prepare(
            'INSERT OR IGNORE INTO permissions (code, description) VALUES (?, ?)'
        );

        for (const perm of courierPermissions) {
            insertPerm.run(perm.code, perm.description);
        }

        // Grant permissions to ADMIN and SUPERVISOR
        const insertRolePerm = db.prepare(
            'INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)'
        );

        const adminRole = db.prepare("SELECT id FROM roles WHERE id = 'ADMIN' OR name = 'Admin' LIMIT 1").get() as { id: string } | undefined;
        const supervisorRole = db.prepare("SELECT id FROM roles WHERE id = 'SUPERVISOR' OR name = 'Supervisor' LIMIT 1").get() as { id: string } | undefined;

        for (const perm of courierPermissions) {
            if (adminRole) insertRolePerm.run(adminRole.id, perm.code);
            if (supervisorRole) insertRolePerm.run(supervisorRole.id, perm.code);
        }
        
        // Also grant VIEW and CREATE to CASHIER (so they can search and save one-time/new couriers)
        const cashierRole = db.prepare("SELECT id FROM roles WHERE id = 'CASHIER' OR name = 'Cashier' LIMIT 1").get() as { id: string } | undefined;
        if (cashierRole) {
            insertRolePerm.run(cashierRole.id, 'DELIVERY_COURIER_VIEW');
            insertRolePerm.run(cashierRole.id, 'DELIVERY_COURIER_CREATE');
        }
    }
};

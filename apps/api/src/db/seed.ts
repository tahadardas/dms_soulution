import type { Database } from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { PERMISSIONS, ROLE_PRESETS } from '../config/permissions';
import { isProduction } from '../config/security';
import { seedInventoryStockFromProducts } from './seed-inventory-stock';

const DEFAULT_ADMIN_HASH = '$2b$10$e.3HgANwqDX5o8Rv7WqxpOXPJFjEvF5TFko8SooiEW4ASlVV8rFSS';
const LEGACY_DEFAULT_ADMIN_HASHES = [
    DEFAULT_ADMIN_HASH,
    '$2b$10$qXc6N.3Hj1wdTY6uvah23.LNGb8Lh0ENKuNqhrzrLLtpgKkMa/h7G'
];

export function seedDatabase(db: Database): void {
    const seed = db.transaction(() => {
        const insertPerm = db.prepare('INSERT OR IGNORE INTO permissions (code, description) VALUES (@code, @description)');
        const insertRole = db.prepare('INSERT OR IGNORE INTO roles (id, name, description) VALUES (@id, @name, @description)');
        const insertRolePerm = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (@role_id, @code)');
        const insertUser = db.prepare(`
            INSERT OR IGNORE INTO users (username, password_hash, role_id, must_change_password)
            VALUES (@username, @hash, @role_id, @must_change_password)
        `);

        for (const code of Object.values(PERMISSIONS)) {
            insertPerm.run({ code, description: code });
        }

        for (const [key, role] of Object.entries(ROLE_PRESETS)) {
            const roleId = key.toLowerCase();
            insertRole.run({ id: roleId, name: role.name, description: role.description });
            for (const code of role.permissions) {
                insertRolePerm.run({ role_id: roleId, code });
            }
        }

        const existingAdmin = db.prepare('SELECT id, password_hash FROM users WHERE username = ?').get('admin') as { id: number; password_hash: string } | undefined;
        if (isProduction() && existingAdmin && LEGACY_DEFAULT_ADMIN_HASHES.includes(existingAdmin.password_hash)) {
            throw new Error('Production cannot run with the default admin/admin123 credentials.');
        }

        const bootstrapPassword = process.env.DMS_BOOTSTRAP_ADMIN_PASSWORD;
        if (!existingAdmin && isProduction() && !bootstrapPassword) {
            throw new Error('DMS_BOOTSTRAP_ADMIN_PASSWORD is required to create the initial production admin user.');
        }

        insertUser.run({
            username: 'admin',
            hash: bootstrapPassword ? bcrypt.hashSync(bootstrapPassword, 10) : DEFAULT_ADMIN_HASH,
            role_id: 'admin',
            must_change_password: 1
        });

        for (const defaultHash of LEGACY_DEFAULT_ADMIN_HASHES) {
            db.prepare('UPDATE users SET must_change_password = 1 WHERE username = ? AND password_hash = ?')
                .run('admin', defaultHash);
        }

        const branchCount = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
        if (branchCount.count === 0) {
            db.prepare('INSERT INTO branches (name, settings) VALUES (?, ?)').run('Main Branch', JSON.stringify({}));
        }

        const defaultBranch = db.prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as { id: number } | undefined;
        if (defaultBranch) {
            db.prepare('UPDATE users SET branch_id = ? WHERE branch_id IS NULL').run(defaultBranch.id);
        }

        const insertAccount = db.prepare('INSERT OR IGNORE INTO accounts (code, name, type, is_system) VALUES (@code, @name, @type, 1)');
        [
            ['1000', 'Assets', 'ASSET'],
            ['1010', 'Cash', 'ASSET'],
            ['1020', 'Bank', 'ASSET'],
            ['1100', 'Current Assets', 'ASSET'],
            ['1200', 'Inventory', 'ASSET'],
            ['2000', 'Liabilities', 'LIABILITY'],
            ['2100', 'Current Liabilities', 'LIABILITY'],
            ['2200', 'Sales Tax Payable', 'LIABILITY'],
            ['3000', 'Equity', 'EQUITY'],
            ['3100', 'Owner Capital', 'EQUITY'],
            ['3200', 'Retained Earnings', 'EQUITY'],
            ['4000', 'Revenue', 'REVENUE'],
            ['4100', 'Sales Revenue', 'REVENUE'],
            ['4200', 'Discounts and Adjustments', 'REVENUE'],
            ['5000', 'Expenses', 'EXPENSE'],
            ['5100', 'Cost of Goods Sold', 'EXPENSE'],
            ['5200', 'Rent', 'EXPENSE'],
            ['5300', 'Salaries', 'EXPENSE']
        ].forEach(([code, name, type]) => insertAccount.run({ code, name, type }));

        db.prepare("UPDATE accounts SET system_role = COALESCE(system_role, 'INVENTORY') WHERE code = '1200'").run();
        db.prepare("UPDATE accounts SET system_role = COALESCE(system_role, 'SALES_REVENUE') WHERE code = '4100'").run();
        db.prepare("UPDATE accounts SET system_role = COALESCE(system_role, 'COGS') WHERE code = '5100'").run();

        const printerCount = db.prepare('SELECT COUNT(*) as count FROM printers').get() as { count: number };
        if (printerCount.count === 0) {
            const branch = db.prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as { id: number } | undefined;
            const insert = db.prepare(
                'INSERT INTO printers (name, type, target, ip_address, branch_id, is_active) VALUES (@name, @type, @target, @ip, @branch_id, 1)'
            );
            insert.run({ name: 'Cashier Printer', type: 'NETWORK', target: 'CASHIER', ip: '192.168.1.200', branch_id: branch?.id ?? null });
            insert.run({ name: 'Kitchen Printer', type: 'NETWORK', target: 'KITCHEN', ip: '192.168.1.201', branch_id: branch?.id ?? null });
            insert.run({ name: 'Bar Printer', type: 'NETWORK', target: 'BAR', ip: '192.168.1.202', branch_id: branch?.id ?? null });
        }

        const templateCount = db.prepare('SELECT COUNT(*) as count FROM print_templates').get() as { count: number };
        if (templateCount.count === 0) {
            const insertTemplate = db.prepare(`
                INSERT INTO print_templates (name, type, content, is_default, is_active, updated_at)
                VALUES (@name, @type, @content, @is_default, 1, datetime('now'))
            `);
            insertTemplate.run({
                name: 'Default Kitchen Ticket',
                type: 'KOT',
                content: [
                    '*** KITCHEN TICKET ***',
                    'Order: {{order_number}}',
                    'Table: {{table_number}}',
                    'Time: {{created_at}}',
                    'Branch: {{branch_name}}',
                    '',
                    '{{items}}',
                    '',
                    '{{notes}}'
                ].join('\n'),
                is_default: 1
            });
            insertTemplate.run({
                name: 'Default Receipt',
                type: 'RECEIPT',
                content: [
                    '*** RECEIPT ***',
                    'Order: {{order_number}}',
                    'Time: {{created_at}}',
                    'Table: {{table_number}}',
                    '',
                    '{{items}}',
                    '',
                    'Total: {{total}}',
                    '',
                    'Thank you!'
                ].join('\n'),
                is_default: 1
            });
            insertTemplate.run({
                name: 'Default Z Report',
                type: 'Z_REPORT',
                content: [
                    '*** Z REPORT ***',
                    'Session: {{session_id}}',
                    'Opened: {{start_time}}',
                    'Closed: {{end_time}}',
                    'Orders: {{orders_count}}',
                    'Sales: {{total_sales}}',
                    '',
                    'Cash: {{closing_cash}}'
                ].join('\n'),
                is_default: 1
            });
        }

        const unitCount = db.prepare('SELECT COUNT(*) as count FROM units').get() as { count: number };
        if (unitCount.count === 0) {
            const insertUnit = db.prepare('INSERT INTO units (name, abbreviation, is_active) VALUES (@name, @abbr, 1)');
            insertUnit.run({ name: 'Piece', abbr: 'pc' });
            insertUnit.run({ name: 'Box', abbr: 'box' });
            insertUnit.run({ name: 'Carton', abbr: 'ctn' });
        }

        const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
        if (settingsCount.count === 0) {
            const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
            insert.run('accounting', JSON.stringify({
                chartOfAccountsMapping: {
                    posCash: '1010',
                    posBank: '1020',
                    revenue: '4100',
                    discounts: '4200',
                    taxPayable: '2200',
                    inventory: '1200',
                    cogs: '5100',
                    Cash: '1010',
                    Bank: '1020',
                    Sales: '4100',
                    COGS: '5100'
                },
                currencyCode: 'USD',
                postingPolicy: 'IMMEDIATE',
                fiscalYearStartMonth: 1,
                fiscalYearStartDay: 1,
                fiscalPeriodType: 'MONTHLY',
                allowManualJournalEntries: true
            }));
            insert.run('costing', JSON.stringify({
                defaultAllocationMethod: 'DIRECT',
                allocationBasis: 'SALES',
                costCentersEnabled: false,
                defaultCostCenter: 'GENERAL',
                costClassificationDefault: 'DIRECT',
                autoCalculateUnitCost: true
            }));
            insert.run('inventory', JSON.stringify({
                valuationMethod: 'WAC',
                defaultUnit: 'Unit',
                lowStockThresholdGlobal: 10,
                autoDeductStockOnSale: true,
                allowNegativeStock: false,
                quantityPrecision: 2,
                unitConversionPolicy: 'STRICT'
            }));
            insert.run('pos', JSON.stringify({
                tablesEnabled: true,
                serviceChargePercentage: 0,
                allowDiscounts: true,
                maxDiscountPercentage: 100,
                discountReasonRequired: false,
                tipsEnabled: true,
                allowReturns: true,
                returnWindowMinutes: 1440,
                returnReasonRequired: true,
                refundWindowMinutes: 1440,
                requireReasonForCashDifference: true,
                cashDifferenceRequiresManager: true,
                managerRequiredCashDifferenceAmount: 25,
                allowCloseSessionWithPendingDelivery: true,
                pendingDeliveryCloseRequiresManager: false,
                requireReasonForVoid: true,
                managerRequiredVoidAfterPayment: true,
                managerRequiredReprint: true
            }));
            insert.run('printing', JSON.stringify({
                defaultReceiptTemplate: 'standard',
                defaultKOTTemplate: 'kitchen-basic',
                defaultZReportTemplate: 'z-report',
                autoPrintReceipt: true,
                autoPrintKOT: true
            }));
            insert.run('theme', JSON.stringify({
                mode: 'light',
                accentColor: '#3b82f6',
                borderRadius: 8
            }));
        }
    });

    seed();
    seedInventoryStockFromProducts(db);
}

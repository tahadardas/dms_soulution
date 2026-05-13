import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openDatabase } from './connection';
import { migrateDatabase } from './migrate';
import { seedDatabase } from './seed';
import { tableExists } from './introspect';

const requiredTables = [
    'schema_migrations',
    'branches',
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'accounts',
    'journal_entries',
    'journal_lines',
    'categories',
    'units',
    'unit_conversions',
    'products',
    'recipes',
    'inventory_movements',
    'inventory_stock',
    'customers',
    'pos_sessions',
    'orders',
    'order_lines',
    'order_notes',
    'payments',
    'cash_movements',
    'returns',
    'return_lines',
    'printers',
    'printer_routes',
    'print_jobs',
    'print_templates',
    'workstations',
    'manager_approvals',
    'fiscal_periods',
    'sequences',
    'audit_logs',
    'settings',
    'settings_history',
    'suppliers',
    'purchase_invoices',
    'purchase_invoice_lines',
    'sales_invoices',
    'sales_invoice_lines',
    'delivery_couriers'
];

function getExpectedMigrationVersions(): string[] {
    const migrationsDir = path.join(__dirname, 'migrations');
    return fs
        .readdirSync(migrationsDir)
        .filter((file) => /^\d{4}_.+\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
        .sort()
        .map((file) => file.slice(0, 4));
}

function verifyPragmas(): void {
    const db = openDatabase(':memory:');
    try {
        assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
        assert.equal(db.pragma('journal_mode', { simple: true }), 'memory');
        assert.equal(db.pragma('busy_timeout', { simple: true }), 5000);
        assert.equal(db.pragma('synchronous', { simple: true }), 1);
    } finally {
        db.close();
    }
}

function verifyEmptyDatabaseMigration(): void {
    const expectedMigrations = getExpectedMigrationVersions();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-db-empty-'));
    const dbPath = path.join(dir, 'dms.db');
    const db = openDatabase(dbPath);
    try {
        const first = migrateDatabase(db, { dbPath });
        assert.deepEqual(first.applied, expectedMigrations);

        seedDatabase(db);

        for (const table of requiredTables) {
            assert.equal(tableExists(db, table), true, `${table} should exist`);
        }

        const second = migrateDatabase(db, { dbPath });
        assert.deepEqual(second.applied, []);
        assert.equal(second.backup.created, false);

        const migrations = db.prepare('SELECT COUNT(*) as count FROM schema_migrations').get() as { count: number };
        assert.equal(migrations.count, expectedMigrations.length);
    } finally {
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

function verifyExistingDatabaseBackupAndDataSafety(): void {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-db-existing-'));
    const dbPath = path.join(dir, 'dms.db');
    let db = openDatabase(dbPath);
    db.exec(`
        CREATE TABLE legacy_keep (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        );
        INSERT INTO legacy_keep (id, name) VALUES (1, 'preserve me');
    `);
    db.close();

    db = openDatabase(dbPath);
    try {
        const result = migrateDatabase(db, { dbPath });
        assert.equal(result.backup.created, true);
        assert.ok(result.backup.path && fs.existsSync(result.backup.path));

        const row = db.prepare('SELECT name FROM legacy_keep WHERE id = 1').get() as { name: string };
        assert.equal(row.name, 'preserve me');
    } finally {
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

verifyPragmas();
verifyEmptyDatabaseMigration();
verifyExistingDatabaseBackupAndDataSafety();

console.log('Database verification passed.');

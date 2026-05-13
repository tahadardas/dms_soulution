const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { openDatabase } = require('../src/db/connection');
const { migrateDatabase } = require('../src/db/migrate');
const { tableExists } = require('../src/db/introspect');

const getExpectedMigrationVersions = () => {
    const migrationsDir = path.join(__dirname, '../src/db/migrations');
    return fs
        .readdirSync(migrationsDir)
        .filter((file) => /^\d{4}_.+\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
        .sort()
        .map((file) => file.slice(0, 4));
};

test('migrations run on an empty database and are idempotent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-test-empty-'));
    const dbPath = path.join(dir, 'dms.db');
    const db = openDatabase(dbPath);

    try {
        const first = migrateDatabase(db, { dbPath });
        assert.deepEqual(first.applied, getExpectedMigrationVersions());
        assert.equal(tableExists(db, 'schema_migrations'), true);
        assert.equal(tableExists(db, 'payments'), true);
        assert.equal(tableExists(db, 'inventory_stock'), true);
        assert.equal(tableExists(db, 'returns'), true);
        assert.equal(tableExists(db, 'return_lines'), true);
        assert.equal(tableExists(db, 'printer_routes'), true);
        assert.equal(tableExists(db, 'print_jobs'), true);
        assert.equal(tableExists(db, 'print_templates'), true);
        assert.equal(tableExists(db, 'manager_approvals'), true);
        assert.equal(tableExists(db, 'fiscal_periods'), true);
        assert.equal(tableExists(db, 'sequences'), true);
        assert.equal(tableExists(db, 'audit_logs'), true);
        assert.equal(tableExists(db, 'settings_history'), true);
        assert.equal(tableExists(db, 'purchase_invoices'), true);
        assert.equal(tableExists(db, 'sales_invoices'), true);

        const second = migrateDatabase(db, { dbPath });
        assert.deepEqual(second.applied, []);
    } finally {
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('migrations preserve existing data and create a backup for non-empty databases', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dms-test-existing-'));
    const dbPath = path.join(dir, 'dms.db');
    let db = openDatabase(dbPath);
    db.exec(`
        CREATE TABLE legacy_keep (
            id INTEGER PRIMARY KEY,
            label TEXT NOT NULL
        );
        INSERT INTO legacy_keep (id, label) VALUES (1, 'keep');
    `);
    db.close();

    db = openDatabase(dbPath);
    try {
        const result = migrateDatabase(db, { dbPath });
        assert.equal(result.backup.created, true);
        assert.ok(result.backup.path);
        assert.equal(fs.existsSync(result.backup.path), true);

        const row = db.prepare('SELECT label FROM legacy_keep WHERE id = 1').get();
        assert.equal(row.label, 'keep');
    } finally {
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

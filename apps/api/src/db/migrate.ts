import type { Database } from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createBackupBeforeMigration, BackupResult } from './backup';
import { TABLES } from './schema';

export interface Migration {
    version: string;
    name: string;
    up: (db: Database) => void;
    down?: (db: Database) => void;
}

export interface MigrationRunResult {
    applied: string[];
    skipped: string[];
    backup: BackupResult;
}

interface LoadedMigration {
    migration: Migration;
    checksum: string;
}

function ensureMigrationTable(db: Database): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS ${TABLES.schemaMigrations} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            checksum TEXT
        );
    `);
}

function loadMigrations(migrationsDir = path.join(__dirname, 'migrations')): LoadedMigration[] {
    const files = fs
        .readdirSync(migrationsDir)
        .filter((file) => /^\d{4}_.+\.(ts|js)$/.test(file) && !file.endsWith('.d.ts'))
        .sort();

    return files.map((file) => {
        const fullPath = path.join(migrationsDir, file);
        const source = fs.readFileSync(fullPath);
        const checksum = crypto.createHash('sha256').update(source).digest('hex');
        const moduleExports = require(fullPath) as { migration?: Migration; default?: Migration };
        const migration = moduleExports.migration || moduleExports.default;

        if (!migration?.version || !migration.name || typeof migration.up !== 'function') {
            throw new Error(`Invalid migration module: ${file}`);
        }

        return { migration, checksum };
    });
}

function getAppliedVersions(db: Database): Set<string> {
    const rows = db
        .prepare(`SELECT version FROM ${TABLES.schemaMigrations}`)
        .all() as Array<{ version: string }>;
    return new Set(rows.map((row) => row.version));
}

function migrationTableExists(db: Database): boolean {
    const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
        .get(TABLES.schemaMigrations) as { name: string } | undefined;
    return Boolean(row);
}

export function migrateDatabase(db: Database, options: { dbPath: string; migrationsDir?: string }): MigrationRunResult {
    const loaded = loadMigrations(options.migrationsDir);
    const appliedVersions = migrationTableExists(db) ? getAppliedVersions(db) : new Set<string>();
    const pending = loaded.filter(({ migration }) => !appliedVersions.has(migration.version));
    const backup = pending.length > 0
        ? createBackupBeforeMigration(db, options.dbPath)
        : { created: false, reason: 'no pending migrations' };

    ensureMigrationTable(db);

    const applied: string[] = [];
    const skipped = loaded
        .filter(({ migration }) => appliedVersions.has(migration.version))
        .map(({ migration }) => migration.version);

    for (const { migration, checksum } of pending) {
        // Disable foreign keys globally before starting the transaction
        // as SQLite doesn't allow changing it inside a transaction.
        db.pragma('foreign_keys = OFF');

        try {
            const runOne = db.transaction(() => {
                migration.up(db);
                db.prepare(
                    `INSERT INTO ${TABLES.schemaMigrations} (version, name, checksum)
                     VALUES (@version, @name, @checksum)`
                ).run({
                    version: migration.version,
                    name: migration.name,
                    checksum
                });
            });

            runOne();
            applied.push(migration.version);
        } finally {
            // Re-enable foreign keys after the transaction
            db.pragma('foreign_keys = ON');
        }
    }

    return { applied, skipped, backup };
}

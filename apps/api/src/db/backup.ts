import type { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface BackupResult {
    created: boolean;
    path?: string;
    reason?: string;
}

function timestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
        '-',
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join('');
}

function hasUserObjects(db: Database): boolean {
    const row = db
        .prepare(
            `SELECT COUNT(*) as count
             FROM sqlite_master
             WHERE type = 'table'
               AND name NOT LIKE 'sqlite_%'
               AND name NOT LIKE '%_fts_%'`
        )
        .get() as { count: number };
    return row.count > 0;
}

export function createBackupBeforeMigration(db: Database, dbPath: string): BackupResult {
    if (dbPath === ':memory:') {
        return { created: false, reason: 'in-memory database' };
    }

    if (!fs.existsSync(dbPath)) {
        return { created: false, reason: 'database file does not exist yet' };
    }

    const stat = fs.statSync(dbPath);
    if (stat.size === 0 || !hasUserObjects(db)) {
        return { created: false, reason: 'database is new or empty' };
    }

    const backupDir = path.join(path.dirname(dbPath), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, `dms-before-migration-${timestamp()}.db`);
    db.pragma('wal_checkpoint(FULL)');
    fs.copyFileSync(dbPath, backupPath, fs.constants.COPYFILE_EXCL);
    return { created: true, path: backupPath };
}

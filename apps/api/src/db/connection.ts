import Database, { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let dbInstance: DatabaseType | undefined;

export function resolveDbPath(): string {
    const override = process.env.DMS_DB_PATH;
    if (override) {
        if (override === ':memory:') return override;
        return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
    }
    return path.resolve(__dirname, '../../../../dms.db');
}

export function applyPragmas(db: DatabaseType): void {
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
}

export function openDatabase(dbPath = resolveDbPath()): DatabaseType {
    if (dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    const db = new Database(dbPath);
    applyPragmas(db);
    return db;
}

export function getDatabaseInstance(factory: () => DatabaseType): DatabaseType {
    if (!dbInstance) {
        dbInstance = factory();
    }
    return dbInstance;
}

export function resetDatabaseInstance(): void {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = undefined;
    }
}

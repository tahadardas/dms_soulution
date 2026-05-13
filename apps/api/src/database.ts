import { Database as DatabaseType } from 'better-sqlite3';
import { getDatabaseInstance, openDatabase, resetDatabaseInstance, resolveDbPath } from './db/connection';
import { migrateDatabase } from './db/migrate';
import { seedDatabase } from './db/seed';

export const initDB = (): DatabaseType => {
    const dbPath = resolveDbPath();
    const db = openDatabase(dbPath);
    migrateDatabase(db, { dbPath });
    seedDatabase(db);
    return db;
};

export const getDB = (): DatabaseType => {
    return getDatabaseInstance(initDB);
};

export const resetDB = (): void => {
    resetDatabaseInstance();
};

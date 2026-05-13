import fs from 'fs';
import path from 'path';
import { Database as DatabaseType } from 'better-sqlite3';
import { resolveDbPath, resetDatabaseInstance } from '../db/connection';

export interface BackupInfo {
    filename: string;
    size: number;
    createdAt: string;
}

export class BackupService {
    private db: DatabaseType;

    constructor(db: DatabaseType) {
        this.db = db;
    }

    private getBackupDir(): string {
        const row = this.db.prepare("SELECT value FROM settings WHERE key = 'backup'").get() as { value: string } | undefined;
        let backupPath = '';
        if (row) {
            try {
                const settings = JSON.parse(row.value);
                backupPath = settings.backupPath;
            } catch (e) {
                // ignore
            }
        }
        
        if (!backupPath) {
            backupPath = path.resolve(process.cwd(), 'backups');
        }

        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }
        return backupPath;
    }

    private resolveBackupFile(filename: string): string {
        if (!filename || filename !== path.basename(filename)) {
            throw new Error('Invalid backup filename');
        }

        const backupDir = this.getBackupDir();
        const backupPath = path.resolve(backupDir, filename);
        const normalizedDir = path.resolve(backupDir);

        if (!backupPath.startsWith(`${normalizedDir}${path.sep}`)) {
            throw new Error('Invalid backup filename');
        }

        return backupPath;
    }

    async createBackup(): Promise<string> {
        const dbPath = resolveDbPath();
        if (dbPath === ':memory:') {
            throw new Error('Cannot backup an in-memory database');
        }

        const backupDir = this.getBackupDir();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `dms-backup-${timestamp}.sqlite`;
        const backupPath = path.join(backupDir, backupFileName);

        // SQLite 'VACUUM INTO' is the safest way to backup while the DB is open
        try {
            this.db.prepare(`VACUUM INTO ?`).run(backupPath);
            return backupFileName;
        } catch (error: any) {
            // Fallback to file copy if VACUUM INTO fails (e.g. older sqlite version, though better-sqlite3 is usually new)
            fs.copyFileSync(dbPath, backupPath);
            return backupFileName;
        }
    }

    listBackups(): BackupInfo[] {
        const backupDir = this.getBackupDir();
        const files = fs.readdirSync(backupDir);
        
        return files
            .filter(f => f.endsWith('.sqlite') || f.endsWith('.db'))
            .map(f => {
                const fullPath = path.join(backupDir, f);
                const stats = fs.statSync(fullPath);
                return {
                    filename: f,
                    size: stats.size,
                    createdAt: stats.birthtime.toISOString()
                };
            })
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    async restoreBackup(filename: string): Promise<void> {
        const backupPath = this.resolveBackupFile(filename);
        const dbPath = resolveDbPath();

        if (!fs.existsSync(backupPath)) {
            throw new Error('Backup file not found');
        }

        if (dbPath === ':memory:') {
            throw new Error('Cannot restore to an in-memory database');
        }

        const openSession = this.db.prepare(`
            SELECT id
            FROM pos_sessions
            WHERE status = 'OPEN'
            LIMIT 1
        `).get();

        if (openSession) {
            throw new Error('Cannot restore backup while POS sessions are open');
        }

        // Close the database connection before replacing the file
        resetDatabaseInstance();

        try {
            // Create a temporary copy of the current DB just in case
            const tempPath = `${dbPath}.tmp`;
            if (fs.existsSync(dbPath)) {
                fs.copyFileSync(dbPath, tempPath);
            }

            try {
                fs.copyFileSync(backupPath, dbPath);
                // Clean up temp copy
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            } catch (err) {
                // Restore the temp copy if it failed
                if (fs.existsSync(tempPath)) {
                    fs.copyFileSync(tempPath, dbPath);
                    fs.unlinkSync(tempPath);
                }
                throw err;
            }
        } finally {
            // Re-open the database (or the process will just exit/restart)
            // In a real production app, we might want to signal a restart
        }
    }

    deleteBackup(filename: string): void {
        const backupPath = this.resolveBackupFile(filename);
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
        }
    }

    updateBackupConfig(backupPath: string): void {
        const normalizedPath = path.resolve(backupPath);
        // Ensure path exists
        if (!fs.existsSync(normalizedPath)) {
            fs.mkdirSync(normalizedPath, { recursive: true });
        }

        const valueJson = JSON.stringify({ backupPath: normalizedPath });
        this.db.prepare(`
            INSERT INTO settings (key, value, version, updated_at)
            VALUES (?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                version = settings.version + 1,
                updated_at = excluded.updated_at
        `).run('backup', valueJson);
    }

    getBackupConfig(): { backupPath: string } {
        const row = this.db.prepare("SELECT value FROM settings WHERE key = 'backup'").get() as { value: string } | undefined;
        if (row) {
            try {
                return JSON.parse(row.value);
            } catch (e) {
                // ignore
            }
        }
        return { backupPath: path.resolve(process.cwd(), 'backups') };
    }
}

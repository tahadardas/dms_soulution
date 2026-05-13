import type { Database } from 'better-sqlite3';

export interface TableColumn {
    cid: number;
    name: string;
    type: string;
    notnull: 0 | 1;
    dflt_value: string | null;
    pk: number;
}

export interface TableIndex {
    seq: number;
    name: string;
    unique: 0 | 1;
    origin: string;
    partial: 0 | 1;
}

export function tableExists(db: Database, tableName: string): boolean {
    const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?")
        .get(tableName) as { name: string } | undefined;
    return Boolean(row);
}

export function columnExists(db: Database, tableName: string, columnName: string): boolean {
    return getTableColumns(db, tableName).some((column) => column.name === columnName);
}

export function indexExists(db: Database, indexName: string): boolean {
    const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?")
        .get(indexName) as { name: string } | undefined;
    return Boolean(row);
}

export function getTableColumns(db: Database, tableName: string): TableColumn[] {
    return db.prepare(`PRAGMA table_info("${tableName}")`).all() as TableColumn[];
}

export function getTableIndexes(db: Database, tableName: string): TableIndex[] {
    return db.prepare(`PRAGMA index_list("${tableName}")`).all() as TableIndex[];
}

export function ensureColumn(db: Database, tableName: string, columnName: string, definition: string): void {
    if (!columnExists(db, tableName, columnName)) {
        db.exec(`ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${definition}`);
    }
}

export function getColumnType(db: Database, tableName: string, columnName: string): string | undefined {
    return getTableColumns(db, tableName).find((column) => column.name === columnName)?.type;
}

export function safeSqliteType(type: string | undefined, fallback: 'INTEGER' | 'TEXT' = 'INTEGER'): 'INTEGER' | 'TEXT' {
    const normalized = String(type || '').toUpperCase();
    if (normalized.includes('TEXT') || normalized.includes('CHAR') || normalized.includes('UUID')) {
        return 'TEXT';
    }
    if (normalized.includes('INT')) {
        return 'INTEGER';
    }
    return fallback;
}

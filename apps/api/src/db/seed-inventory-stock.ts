import type { Database } from 'better-sqlite3';
import crypto from 'crypto';
import { insertInventoryMovement, syncLegacyProductStock, upsertStockRow } from '../repositories/inventory.repository';

const SEED_MARKER_KEY = 'inventory_stock_seeded_from_products';

interface ProductOpeningStockRow {
    id: number;
    stock_quantity: number;
    cost: number | null;
}

function isSeedMarked(db: Database): boolean {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SEED_MARKER_KEY) as { value: string } | undefined;
    if (!row) return false;
    try {
        const value = JSON.parse(row.value) as { seeded?: boolean } | boolean;
        return value === true || (typeof value === 'object' && value.seeded === true);
    } catch {
        return false;
    }
}

function markSeeded(db: Database, insertedRows: number): void {
    db.prepare(`
        INSERT INTO settings (key, value, version, updated_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            version = settings.version + 1,
            updated_at = CURRENT_TIMESTAMP
    `).run(SEED_MARKER_KEY, JSON.stringify({
        seeded: true,
        source: 'products.stock_quantity',
        insertedRows,
        seededAt: new Date().toISOString()
    }));
}

function getDefaultBranchId(db: Database): number {
    const existing = db.prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as { id: number } | undefined;
    if (existing) return existing.id;
    const created = db.prepare('INSERT INTO branches (name, settings) VALUES (?, ?)').run('Main Branch', '{}');
    return Number(created.lastInsertRowid);
}

export function seedInventoryStockFromProducts(db: Database): void {
    if (isSeedMarked(db)) {
        return;
    }

    const seed = db.transaction(() => {
        const existingStock = db.prepare('SELECT COUNT(*) as count FROM inventory_stock').get() as { count: number };
        if (existingStock.count > 0) {
            markSeeded(db, 0);
            return;
        }

        const products = db.prepare(`
            SELECT id, stock_quantity, cost
            FROM products
            WHERE COALESCE(stock_quantity, 0) > 0
            ORDER BY id
        `).all() as ProductOpeningStockRow[];

        if (products.length === 0) {
            markSeeded(db, 0);
            return;
        }

        const branchId = getDefaultBranchId(db);
        const referenceId = `OPENING-${crypto.randomUUID()}`;
        for (const product of products) {
            const quantity = product.stock_quantity;
            const unitCost = product.cost ?? 0;
            upsertStockRow(db, branchId, product.id, quantity, unitCost);
            insertInventoryMovement(db, {
                id: crypto.randomUUID(),
                date: new Date().toISOString(),
                type: 'OPENING_BALANCE',
                product_id: product.id,
                quantity,
                unit_cost: unitCost,
                reference_id: referenceId,
                description: 'Opening balance seeded from products.stock_quantity',
                branch_id: branchId,
                reason: 'Phase C initial inventory stock seed',
                created_by: null
            });
            syncLegacyProductStock(db, product.id);
        }

        markSeeded(db, products.length);
    });

    seed();
}

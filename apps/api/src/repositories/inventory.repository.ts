import { Database as DatabaseType } from 'better-sqlite3';

export type InventoryMovementType =
    | 'IN'
    | 'OUT'
    | 'ADJUST'
    | 'ADJUSTMENT'
    | 'PURCHASE'
    | 'SALE'
    | 'RETURN'
    | 'TRANSFER_IN'
    | 'TRANSFER_OUT'
    | 'RECIPE_CONSUMPTION'
    | 'OPENING_BALANCE';

export interface ProductStockRow {
    id: number;
    name: string;
    type: string;
    cost: number | null;
    stock_quantity: number | null;
}

export interface StockRow {
    branch_id: number;
    product_id: number;
    quantity_on_hand: number;
    average_cost: number;
    updated_at: string;
}

export interface RecipeComponentRow {
    product_id: number;
    ingredient_id: number;
    quantity: number;
    unit_id: number | null;
    waste_percent: number | null;
    notes: string | null;
    ingredient_name: string;
    ingredient_type: string;
    ingredient_cost: number | null;
}

export interface InsertInventoryMovementInput {
    id: string;
    date: string;
    type: InventoryMovementType;
    product_id: number;
    quantity: number;
    unit_cost?: number | null;
    reference_id?: string | null;
    description?: string | null;
    branch_id?: number | null;
    reason?: string | null;
    created_by?: number | null;
}

export interface RebuildMovementRow {
    id: string;
    date: string;
    type: string;
    product_id: number;
    quantity: number;
    unit_cost: number | null;
    branch_id: number | null;
    created_at: string | null;
}

export function getProductById(db: DatabaseType, productId: number): ProductStockRow | undefined {
    return db.prepare(`
        SELECT id, name, type, cost, stock_quantity
        FROM products
        WHERE id = ?
    `).get(productId) as ProductStockRow | undefined;
}

export function getStockRow(db: DatabaseType, branchId: number, productId: number): StockRow | undefined {
    return db.prepare(`
        SELECT branch_id, product_id, quantity_on_hand, average_cost, updated_at
        FROM inventory_stock
        WHERE branch_id = ? AND product_id = ?
    `).get(branchId, productId) as StockRow | undefined;
}

export function upsertStockRow(
    db: DatabaseType,
    branchId: number,
    productId: number,
    quantityOnHand: number,
    averageCost: number
): void {
    db.prepare(`
        INSERT INTO inventory_stock (branch_id, product_id, quantity_on_hand, average_cost, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(branch_id, product_id) DO UPDATE SET
            quantity_on_hand = excluded.quantity_on_hand,
            average_cost = excluded.average_cost,
            updated_at = CURRENT_TIMESTAMP
    `).run(branchId, productId, quantityOnHand, averageCost);
}

export function insertInventoryMovement(db: DatabaseType, movement: InsertInventoryMovementInput): void {
    db.prepare(`
        INSERT INTO inventory_movements (
            id, date, type, product_id, quantity, unit_cost, reference_id,
            description, branch_id, reason, created_by
        )
        VALUES (
            @id, @date, @type, @product_id, @quantity, @unit_cost, @reference_id,
            @description, @branch_id, @reason, @created_by
        )
    `).run({
        id: movement.id,
        date: movement.date,
        type: movement.type,
        product_id: movement.product_id,
        quantity: movement.quantity,
        unit_cost: movement.unit_cost ?? null,
        reference_id: movement.reference_id ?? null,
        description: movement.description ?? null,
        branch_id: movement.branch_id ?? null,
        reason: movement.reason ?? null,
        created_by: movement.created_by ?? null
    });
}

export function getRecipeComponents(db: DatabaseType, productId: number): RecipeComponentRow[] {
    return db.prepare(`
        SELECT
            r.product_id,
            r.ingredient_id,
            r.quantity,
            r.unit_id,
            r.waste_percent,
            r.notes,
            p.name as ingredient_name,
            p.type as ingredient_type,
            p.cost as ingredient_cost
        FROM recipes r
        JOIN products p ON p.id = r.ingredient_id
        WHERE r.product_id = ?
        ORDER BY r.id
    `).all(productId) as RecipeComponentRow[];
}

export function syncLegacyProductStock(db: DatabaseType, productId: number): void {
    const aggregate = db.prepare(`
        SELECT
            COALESCE(SUM(quantity_on_hand), 0) as total_quantity,
            CASE
                WHEN SUM(quantity_on_hand) > 0 THEN
                    SUM(quantity_on_hand * average_cost) / SUM(quantity_on_hand)
                ELSE NULL
            END as weighted_cost
        FROM inventory_stock
        WHERE product_id = ?
    `).get(productId) as { total_quantity: number; weighted_cost: number | null };

    const product = getProductById(db, productId);
    if (!product) return;

    db.prepare(`
        UPDATE products
        SET stock_quantity = ?,
            cost = ?,
            updated_at = datetime('now')
        WHERE id = ?
    `).run(
        aggregate.total_quantity || 0,
        aggregate.weighted_cost ?? product.cost ?? 0,
        productId
    );
}

export function clearStockSnapshot(db: DatabaseType): void {
    db.prepare('DELETE FROM inventory_stock').run();
}

export function listMovementsForRebuild(db: DatabaseType, branchId?: number): RebuildMovementRow[] {
    const branchClause = branchId ? 'WHERE branch_id = ?' : '';
    const params = branchId ? [branchId] : [];
    return db.prepare(`
        SELECT id, date, type, product_id, quantity, unit_cost, branch_id, created_at
        FROM inventory_movements
        ${branchClause}
        ORDER BY date ASC, created_at ASC, id ASC
    `).all(...params) as RebuildMovementRow[];
}

export function listProductIdsWithStock(db: DatabaseType): number[] {
    const rows = db.prepare(`
        SELECT DISTINCT product_id
        FROM inventory_stock
        ORDER BY product_id
    `).all() as { product_id: number }[];
    return rows.map(row => row.product_id);
}

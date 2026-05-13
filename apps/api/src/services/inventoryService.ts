import { Database as DatabaseType } from 'better-sqlite3';
import crypto from 'crypto';
import { InsightService } from './insightService';
import { SettingsService } from './settingsService';
import {
    clearStockSnapshot,
    getProductById as getRepositoryProductById,
    getRecipeComponents,
    getStockRow,
    insertInventoryMovement,
    InventoryMovementType,
    listMovementsForRebuild,
    listProductIdsWithStock,
    ProductStockRow,
    syncLegacyProductStock,
    upsertStockRow
} from '../repositories/inventory.repository';

export interface ProductFilters {
    search?: string;
    categoryId?: number;
    type?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
}

export interface ProductInput {
    name: string;
    sku: string;
    type: string;
    price: number;
    description?: string | null;
    min_stock_level?: number | null;
    category_id?: number | null;
    unit_id?: number | null;
    is_active?: number | boolean;
}

export interface RecipeLineInput {
    ingredient_id: number;
    quantity: number;
    unit_id?: number | null;
    waste_percent?: number | null;
    notes?: string | null;
}

export interface InventoryItemFilters {
    search?: string;
    categoryId?: number;
    isActive?: boolean;
    branchId?: number;
    page?: number;
    pageSize?: number;
}

export interface MovementFilters {
    startDate?: string;
    endDate?: string;
    type?: string;
    branchId?: number;
    productId?: number;
    page?: number;
    pageSize?: number;
}

export interface TransferInput {
    from_branch_id: number;
    to_branch_id: number;
    product_id: number;
    quantity: number;
    reason: string;
    reference_id?: string | null;
    description?: string | null;
    unit_cost?: number | null;
    date?: string;
}

export interface GetStockLevelInput {
    branchId: string | number | null;
    productId: string | number;
}

export interface StockLevelResult {
    branchId: string | number;
    productId: string | number;
    quantityOnHand: number;
    averageCost: number;
}

export interface EnsureStockAvailableInput extends GetStockLevelInput {
    quantity: number;
    allowNegativeStock?: boolean;
}

export interface StockInInput extends GetStockLevelInput {
    quantity: number;
    unitCost?: number | null;
    type?: InventoryMovementType;
    referenceId?: string | null;
    description?: string | null;
    reason?: string | null;
    date?: string;
    createdBy?: number | null;
}

export interface StockOutInput extends GetStockLevelInput {
    quantity: number;
    type?: InventoryMovementType;
    referenceId?: string | null;
    description?: string | null;
    reason?: string | null;
    date?: string;
    createdBy?: number | null;
    allowNegativeStock?: boolean;
}

export interface StockOutResult {
    movementId: string;
    issuedCost: number;
    unitCost: number;
    quantityOnHand: number;
    averageCost: number;
}

export interface AdjustStockInput extends GetStockLevelInput {
    quantityDelta: number;
    unitCost?: number | null;
    reason: string;
    referenceId?: string | null;
    description?: string | null;
    date?: string;
    createdBy?: number | null;
    allowNegativeStock?: boolean;
}

export interface TransferStockItemInput {
    productId: string | number;
    quantity: number;
}

export interface TransferStockInput {
    fromBranchId: string | number;
    toBranchId: string | number;
    items: TransferStockItemInput[];
    reason: string;
    referenceId?: string | null;
    description?: string | null;
    date?: string;
    createdBy?: number | null;
    allowNegativeStock?: boolean;
}

export interface ReturnStockInput extends GetStockLevelInput {
    quantity: number;
    unitCost?: number | null;
    referenceId: string;
    description?: string | null;
    reason?: string | null;
    date?: string;
    createdBy?: number | null;
}

export interface ConsumeRecipeInput extends GetStockLevelInput {
    quantity: number;
    referenceId: string;
    date?: string;
    createdBy?: number | null;
    allowNegativeStock?: boolean;
}

export interface RebuildStockSnapshotResult {
    rebuiltRows: number;
    warnings: string[];
}

type InventoryMovementInput = {
    date: string;
    type: InventoryMovementType | string;
    product_id: number;
    quantity: number;
    unit_cost?: number | null;
    reference_id?: string | null;
    description?: string | null;
    branch_id?: number | null;
    reason?: string | null;
    created_by?: number | null;
};

export class InventoryService {
    private db: DatabaseType;
    private insightService: InsightService;
    private settingsService: SettingsService;

    constructor(db: DatabaseType) {
        this.db = db;
        this.insightService = new InsightService(db);
        this.settingsService = new SettingsService(db);
    }

    createProduct(product: ProductInput, userId?: number) {
        const stmt = this.db.prepare(`
            INSERT INTO products (
                name, sku, type, description, price, cost, stock_quantity, min_stock_level,
                category_id, unit_id, is_active, created_by, updated_by, updated_at
            )
            VALUES (
                @name, @sku, @type, @description, @price, 0, 0, @min_stock_level,
                @category_id, @unit_id, @is_active, @created_by, @updated_by, datetime('now')
            )
        `);
        const payload = {
            ...product,
            description: product.description ?? null,
            min_stock_level: product.min_stock_level ?? null,
            category_id: product.category_id ?? null,
            unit_id: product.unit_id ?? null,
            is_active: typeof product.is_active === 'boolean' ? (product.is_active ? 1 : 0) : (product.is_active ?? 1),
            created_by: userId ?? null,
            updated_by: userId ?? null
        };
        const info = stmt.run(payload);
        return { ...payload, id: info.lastInsertRowid, stock_quantity: 0, cost: 0 };
    }

    updateProduct(id: number, updates: Partial<ProductInput>, userId?: number) {
        const current = this.getProductById(id);
        if (!current) throw new Error('Product not found');
        const next = {
            ...current,
            ...updates
        };
        this.db.prepare(`
            UPDATE products
            SET name = @name,
                sku = @sku,
                type = @type,
                description = @description,
                price = @price,
                min_stock_level = @min_stock_level,
                category_id = @category_id,
                unit_id = @unit_id,
                is_active = @is_active,
                updated_by = @updated_by,
                updated_at = datetime('now')
            WHERE id = @id
        `).run({
            id,
            name: next.name,
            sku: next.sku,
            type: next.type,
            description: next.description ?? null,
            price: next.price,
            min_stock_level: next.min_stock_level ?? null,
            category_id: next.category_id ?? null,
            unit_id: next.unit_id ?? null,
            is_active: typeof next.is_active === 'boolean' ? (next.is_active ? 1 : 0) : (next.is_active ?? 1),
            updated_by: userId ?? null
        });
        return this.getProductById(id);
    }

    archiveProduct(id: number, userId?: number) {
        this.db.prepare(`
            UPDATE products SET is_active = 0, updated_by = ?, updated_at = datetime('now') WHERE id = ?
        `).run(userId ?? null, id);
        return { success: true };
    }

    getProductById(id: number) {
        return this.db.prepare(`
            SELECT p.*, c.name as category_name, u.name as unit_name, u.abbreviation as unit_abbr
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN units u ON u.id = p.unit_id
            WHERE p.id = ?
        `).get(id);
    }

    getProducts(filters: ProductFilters = {}) {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const offset = (page - 1) * pageSize;
        const clauses: string[] = [];
        const params: any[] = [];
        const search = (filters.search || '').trim();
        const useSearch = search.length >= 2;
        if (useSearch) {
            const query = search.split(/\s+/).map(term => `${term}*`).join(' ');
            clauses.push('products_fts MATCH ?');
            params.push(query);
        }
        if (filters.categoryId) {
            clauses.push('p.category_id = ?');
            params.push(filters.categoryId);
        }
        if (filters.type) {
            clauses.push('p.type = ?');
            params.push(filters.type);
        }
        if (typeof filters.isActive === 'boolean') {
            clauses.push('p.is_active = ?');
            params.push(filters.isActive ? 1 : 0);
        }

        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const joinSearch = useSearch ? 'JOIN products_fts fts ON p.id = fts.rowid' : '';

        const countRow = this.db.prepare(`
            SELECT COUNT(*) as count
            FROM products p
            ${joinSearch}
            ${whereClause}
        `).get(...params) as { count: number };

        const items = this.db.prepare(`
            SELECT p.*, c.name as category_name, u.name as unit_name, u.abbreviation as unit_abbr
            FROM products p
            ${joinSearch}
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN units u ON u.id = p.unit_id
            ${whereClause}
            ORDER BY p.name
            LIMIT ? OFFSET ?
        `).all(...params, pageSize, offset);

        return { items, total: countRow.count || 0, page, pageSize };
    }

    listCategories(includeInactive = true) {
        const clause = includeInactive ? '' : 'WHERE is_active = 1';
        return this.db.prepare(`
            SELECT * FROM categories ${clause} ORDER BY name
        `).all();
    }

    createCategory(data: { name: string; description?: string | null; color?: string | null }, userId?: number) {
        const info = this.db.prepare(`
            INSERT INTO categories (name, description, color, is_active, created_by, updated_by, updated_at)
            VALUES (@name, @description, @color, 1, @created_by, @updated_by, datetime('now'))
        `).run({
            name: data.name,
            description: data.description ?? null,
            color: data.color ?? null,
            created_by: userId ?? null,
            updated_by: userId ?? null
        });
        return { id: info.lastInsertRowid, name: data.name, description: data.description ?? null, color: data.color ?? null, is_active: 1 };
    }

    updateCategory(id: number, data: { name: string; description?: string | null; color?: string | null; is_active?: number | boolean }, userId?: number) {
        this.db.prepare(`
            UPDATE categories
            SET name = @name,
                description = @description,
                color = @color,
                is_active = @is_active,
                updated_by = @updated_by,
                updated_at = datetime('now')
            WHERE id = @id
        `).run({
            id,
            name: data.name,
            description: data.description ?? null,
            color: data.color ?? null,
            is_active: typeof data.is_active === 'boolean' ? (data.is_active ? 1 : 0) : (data.is_active ?? 1),
            updated_by: userId ?? null
        });
        return this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    }

    archiveCategory(id: number, userId?: number) {
        this.db.prepare(`
            UPDATE categories SET is_active = 0, updated_by = ?, updated_at = datetime('now') WHERE id = ?
        `).run(userId ?? null, id);
        return { success: true };
    }

    listUnits(includeInactive = true) {
        const clause = includeInactive ? '' : 'WHERE is_active = 1';
        return this.db.prepare(`
            SELECT * FROM units ${clause} ORDER BY name
        `).all();
    }

    createUnit(data: { name: string; abbreviation: string }, userId?: number) {
        const info = this.db.prepare(`
            INSERT INTO units (name, abbreviation, is_active, created_by, updated_by, updated_at)
            VALUES (@name, @abbr, 1, @created_by, @updated_by, datetime('now'))
        `).run({
            name: data.name,
            abbr: data.abbreviation,
            created_by: userId ?? null,
            updated_by: userId ?? null
        });
        return { id: info.lastInsertRowid, name: data.name, abbreviation: data.abbreviation, is_active: 1 };
    }

    updateUnit(id: number, data: { name: string; abbreviation: string; is_active?: number | boolean }, userId?: number) {
        this.db.prepare(`
            UPDATE units
            SET name = @name,
                abbreviation = @abbr,
                is_active = @is_active,
                updated_by = @updated_by,
                updated_at = datetime('now')
            WHERE id = @id
        `).run({
            id,
            name: data.name,
            abbr: data.abbreviation,
            is_active: typeof data.is_active === 'boolean' ? (data.is_active ? 1 : 0) : (data.is_active ?? 1),
            updated_by: userId ?? null
        });
        return this.db.prepare('SELECT * FROM units WHERE id = ?').get(id);
    }

    archiveUnit(id: number, userId?: number) {
        this.db.prepare(`
            UPDATE units SET is_active = 0, updated_by = ?, updated_at = datetime('now') WHERE id = ?
        `).run(userId ?? null, id);
        return { success: true };
    }

    listUnitConversions() {
        return this.db.prepare(`
            SELECT uc.*, fu.name as from_name, fu.abbreviation as from_abbr,
                   tu.name as to_name, tu.abbreviation as to_abbr
            FROM unit_conversions uc
            JOIN units fu ON fu.id = uc.from_unit_id
            JOIN units tu ON tu.id = uc.to_unit_id
            ORDER BY fu.name, tu.name
        `).all();
    }

    upsertUnitConversion(data: { from_unit_id: number; to_unit_id: number; multiplier: number }, userId?: number) {
        this.db.prepare(`
            INSERT INTO unit_conversions (from_unit_id, to_unit_id, multiplier, created_by, updated_by, updated_at)
            VALUES (@from_unit_id, @to_unit_id, @multiplier, @created_by, @updated_by, datetime('now'))
            ON CONFLICT(from_unit_id, to_unit_id) DO UPDATE SET
                multiplier = excluded.multiplier,
                updated_by = excluded.updated_by,
                updated_at = datetime('now')
        `).run({
            ...data,
            created_by: userId ?? null,
            updated_by: userId ?? null
        });
        return { success: true };
    }

    deleteUnitConversion(id: number) {
        this.db.prepare('DELETE FROM unit_conversions WHERE id = ?').run(id);
        return { success: true };
    }

    getRecipe(productId: number) {
        return this.db.prepare(`
            SELECT r.*, p.name as ingredient_name, u.name as unit_name, u.abbreviation as unit_abbr
            FROM recipes r
            JOIN products p ON p.id = r.ingredient_id
            LEFT JOIN units u ON u.id = r.unit_id
            WHERE r.product_id = ?
            ORDER BY p.name
        `).all(productId);
    }

    replaceRecipe(productId: number, items: RecipeLineInput[], userId?: number) {
        const txn = this.db.transaction(() => {
            this.db.prepare('DELETE FROM recipes WHERE product_id = ?').run(productId);
            const insert = this.db.prepare(`
                INSERT INTO recipes (product_id, ingredient_id, quantity, unit_id, waste_percent, notes, created_by, updated_by, updated_at)
                VALUES (@product_id, @ingredient_id, @quantity, @unit_id, @waste_percent, @notes, @created_by, @updated_by, datetime('now'))
            `);
            for (const item of items) {
                insert.run({
                    product_id: productId,
                    ingredient_id: item.ingredient_id,
                    quantity: item.quantity,
                    unit_id: item.unit_id ?? null,
                    waste_percent: item.waste_percent ?? null,
                    notes: item.notes ?? null,
                    created_by: userId ?? null,
                    updated_by: userId ?? null
                });
            }
            this.db.prepare('UPDATE products SET updated_by = ?, updated_at = datetime(\'now\') WHERE id = ?')
                .run(userId ?? null, productId);
        });
        txn();
        return this.getRecipe(productId);
    }

    private getInventorySettings() {
        const raw = (this.settingsService.getSettings('inventory') || {}) as Record<string, unknown>;
        const valuationMethod = raw.valuationMethod === 'FIFO' ? 'FIFO' : 'WAC';
        return {
            valuationMethod,
            lowStockThresholdGlobal: typeof raw.lowStockThresholdGlobal === 'number' ? raw.lowStockThresholdGlobal : 0,
            autoDeductStockOnSale: raw.autoDeductStockOnSale !== false,
            allowNegativeStock: raw.allowNegativeStock === true
        };
    }

    private runAtomic<T>(work: () => T): T {
        if (this.db.inTransaction) {
            return work();
        }
        return this.db.transaction(work)();
    }

    private normalizeId(value: string | number | null | undefined, fieldName: string): number {
        const id = typeof value === 'number' ? value : Number(value);
        if (!Number.isInteger(id) || id <= 0) {
            throw new Error(`${fieldName} must be a valid positive id`);
        }
        return id;
    }

    private requirePositiveQuantity(value: number, fieldName = 'quantity'): number {
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`${fieldName} must be greater than zero`);
        }
        return value;
    }

    private requireNonZeroQuantity(value: number, fieldName = 'quantity'): number {
        if (!Number.isFinite(value) || value === 0) {
            throw new Error(`${fieldName} must be non-zero`);
        }
        return value;
    }

    private resolveBranchId(branchId?: string | number | null): number {
        if (branchId !== undefined && branchId !== null && branchId !== '') {
            return this.normalizeId(branchId, 'branchId');
        }

        const existing = this.db.prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as { id: number } | undefined;
        if (existing) {
            return existing.id;
        }

        const created = this.db.prepare('INSERT INTO branches (name, settings) VALUES (?, ?)').run('Main Branch', '{}');
        return Number(created.lastInsertRowid);
    }

    private requireProduct(productId: number): ProductStockRow {
        const product = getRepositoryProductById(this.db, productId);
        if (!product) {
            throw new Error(`Product ${productId} not found`);
        }
        return product;
    }

    private normalizeMovementType(type: string): InventoryMovementType {
        const normalized = type.toUpperCase();
        const allowed: readonly string[] = [
            'IN',
            'OUT',
            'ADJUST',
            'ADJUSTMENT',
            'PURCHASE',
            'SALE',
            'RETURN',
            'TRANSFER_IN',
            'TRANSFER_OUT',
            'RECIPE_CONSUMPTION',
            'OPENING_BALANCE'
        ];
        if (!allowed.includes(normalized)) {
            throw new Error(`Unsupported inventory movement type: ${type}`);
        }
        return normalized as InventoryMovementType;
    }

    private applyWeightedAverageCost(currentQty: number, currentCost: number, incomingQty: number, unitCost: number) {
        if (currentQty <= 0) {
            return unitCost;
        }
        const totalValue = (currentQty * currentCost) + (incomingQty * unitCost);
        const totalQty = currentQty + incomingQty;
        return totalQty > 0 ? totalValue / totalQty : unitCost;
    }

    private applyFifoCost(currentQty: number, currentCost: number, incomingQty: number, unitCost: number) {
        return this.applyWeightedAverageCost(currentQty, currentCost, incomingQty, unitCost);
    }

    private applyCosting(currentQty: number, currentCost: number, incomingQty: number, unitCost: number) {
        const { valuationMethod } = this.getInventorySettings();
        if (valuationMethod === 'FIFO') {
            return this.applyFifoCost(currentQty, currentCost, incomingQty, unitCost);
        }
        return this.applyWeightedAverageCost(currentQty, currentCost, incomingQty, unitCost);
    }

    private stockInCore(input: StockInInput): StockLevelResult & { movementId: string } {
        const branchId = this.resolveBranchId(input.branchId);
        const productId = this.normalizeId(input.productId, 'productId');
        const quantity = this.requirePositiveQuantity(input.quantity);
        const product = this.requireProduct(productId);
        const current = getStockRow(this.db, branchId, productId);
        const oldQuantity = current?.quantity_on_hand ?? 0;
        const oldAverageCost = current?.average_cost ?? product.cost ?? 0;
        const unitCost = input.unitCost ?? oldAverageCost;
        const nextAverageCost = this.applyCosting(oldQuantity, oldAverageCost, quantity, unitCost);
        const nextQuantity = oldQuantity + quantity;
        const movementId = crypto.randomUUID();
        const type = input.type ? this.normalizeMovementType(input.type) : 'IN';

        if (type === 'OUT' || type === 'SALE' || type === 'TRANSFER_OUT' || type === 'RECIPE_CONSUMPTION') {
            throw new Error(`${type} is not valid for stockIn`);
        }

        if (unitCost > 0) {
            void this.insightService.checkCostAnomaly(productId, unitCost);
        }

        insertInventoryMovement(this.db, {
            id: movementId,
            date: input.date || new Date().toISOString(),
            type,
            product_id: productId,
            quantity,
            unit_cost: unitCost,
            reference_id: input.referenceId ?? movementId,
            description: input.description ?? null,
            branch_id: branchId,
            reason: input.reason ?? null,
            created_by: input.createdBy ?? null
        });
        upsertStockRow(this.db, branchId, productId, nextQuantity, nextAverageCost);
        syncLegacyProductStock(this.db, productId);

        return {
            movementId,
            branchId,
            productId,
            quantityOnHand: nextQuantity,
            averageCost: nextAverageCost
        };
    }

    private stockOutCore(input: StockOutInput): StockOutResult {
        const branchId = this.resolveBranchId(input.branchId);
        const productId = this.normalizeId(input.productId, 'productId');
        const quantity = this.requirePositiveQuantity(input.quantity);
        const product = this.requireProduct(productId);
        const current = getStockRow(this.db, branchId, productId);
        const currentQuantity = current?.quantity_on_hand ?? 0;
        const currentAverageCost = current?.average_cost ?? product.cost ?? 0;
        const allowNegativeStock = input.allowNegativeStock ?? this.getInventorySettings().allowNegativeStock;

        if (!allowNegativeStock && currentQuantity + 0.000001 < quantity) {
            throw new Error(
                `Insufficient stock for productId=${productId}, branchId=${branchId}, requested=${quantity}, available=${currentQuantity}`
            );
        }

        const movementId = crypto.randomUUID();
        const type = input.type ? this.normalizeMovementType(input.type) : 'OUT';
        if (type === 'IN' || type === 'PURCHASE' || type === 'TRANSFER_IN' || type === 'RETURN' || type === 'OPENING_BALANCE') {
            throw new Error(`${type} is not valid for stockOut`);
        }

        const nextQuantity = currentQuantity - quantity;
        const issuedCost = quantity * currentAverageCost;

        insertInventoryMovement(this.db, {
            id: movementId,
            date: input.date || new Date().toISOString(),
            type,
            product_id: productId,
            quantity: -quantity,
            unit_cost: currentAverageCost,
            reference_id: input.referenceId ?? movementId,
            description: input.description ?? null,
            branch_id: branchId,
            reason: input.reason ?? null,
            created_by: input.createdBy ?? null
        });
        upsertStockRow(this.db, branchId, productId, nextQuantity, currentAverageCost);
        syncLegacyProductStock(this.db, productId);

        return {
            movementId,
            issuedCost,
            unitCost: currentAverageCost,
            quantityOnHand: nextQuantity,
            averageCost: currentAverageCost
        };
    }

    getStockLevel(input: GetStockLevelInput): StockLevelResult {
        const branchId = this.resolveBranchId(input.branchId);
        const productId = this.normalizeId(input.productId, 'productId');
        const product = this.requireProduct(productId);
        const row = getStockRow(this.db, branchId, productId);
        return {
            branchId,
            productId,
            quantityOnHand: row?.quantity_on_hand ?? 0,
            averageCost: row?.average_cost ?? product.cost ?? 0
        };
    }

    ensureStockAvailable(input: EnsureStockAvailableInput): void {
        const quantity = this.requirePositiveQuantity(input.quantity);
        const level = this.getStockLevel(input);
        const allowNegativeStock = input.allowNegativeStock ?? this.getInventorySettings().allowNegativeStock;
        if (!allowNegativeStock && level.quantityOnHand + 0.000001 < quantity) {
            throw new Error(
                `Insufficient stock for productId=${level.productId}, branchId=${level.branchId}, requested=${quantity}, available=${level.quantityOnHand}`
            );
        }
    }

    stockIn(input: StockInInput): StockLevelResult & { movementId: string } {
        return this.runAtomic(() => this.stockInCore(input));
    }

    stockOut(input: StockOutInput): StockOutResult {
        return this.runAtomic(() => this.stockOutCore(input));
    }

    adjustStock(input: AdjustStockInput) {
        return this.runAtomic(() => {
            const quantityDelta = this.requireNonZeroQuantity(input.quantityDelta, 'quantityDelta');
            if (quantityDelta > 0) {
                return this.stockInCore({
                    ...input,
                    quantity: quantityDelta,
                    type: 'ADJUST',
                    referenceId: input.referenceId ?? `ADJ-${crypto.randomUUID()}`
                });
            }
            return this.stockOutCore({
                ...input,
                quantity: Math.abs(quantityDelta),
                type: 'ADJUST',
                referenceId: input.referenceId ?? `ADJ-${crypto.randomUUID()}`
            });
        });
    }

    transferStock(input: TransferStockInput) {
        return this.runAtomic(() => {
            const fromBranchId = this.resolveBranchId(input.fromBranchId);
            const toBranchId = this.resolveBranchId(input.toBranchId);
            if (fromBranchId === toBranchId) {
                throw new Error('Transfer requires different source and destination branches.');
            }
            if (!input.items.length) {
                throw new Error('Transfer must include at least one item');
            }

            const referenceId = input.referenceId ?? `TR-${crypto.randomUUID()}`;
            const date = input.date || new Date().toISOString();
            const movements: { productId: number; outMovementId: string; inMovementId: string; unitCost: number; issuedCost: number }[] = [];

            for (const item of input.items) {
                const productId = this.normalizeId(item.productId, 'productId');
                const quantity = this.requirePositiveQuantity(item.quantity);
                const out = this.stockOutCore({
                    branchId: fromBranchId,
                    productId,
                    quantity,
                    type: 'TRANSFER_OUT',
                    referenceId,
                    description: input.description ?? 'Transfer out',
                    reason: input.reason,
                    date,
                    createdBy: input.createdBy ?? null,
                    allowNegativeStock: input.allowNegativeStock
                });
                const incoming = this.stockInCore({
                    branchId: toBranchId,
                    productId,
                    quantity,
                    unitCost: out.unitCost,
                    type: 'TRANSFER_IN',
                    referenceId,
                    description: input.description ?? 'Transfer in',
                    reason: input.reason,
                    date,
                    createdBy: input.createdBy ?? null
                });
                movements.push({
                    productId,
                    outMovementId: out.movementId,
                    inMovementId: incoming.movementId,
                    unitCost: out.unitCost,
                    issuedCost: out.issuedCost
                });
            }

            return { success: true, reference_id: referenceId, movements };
        });
    }

    returnStock(input: ReturnStockInput) {
        return this.runAtomic(() => {
            const level = this.getStockLevel(input);
            const unitCost = input.unitCost ?? level.averageCost;
            return this.stockInCore({
                ...input,
                unitCost,
                type: 'RETURN',
                referenceId: input.referenceId,
                description: input.description ?? `Return ${input.referenceId}`
            });
        });
    }

    consumeRecipe(input: ConsumeRecipeInput) {
        return this.runAtomic(() => {
            const productId = this.normalizeId(input.productId, 'productId');
            const branchId = this.resolveBranchId(input.branchId);
            const quantity = this.requirePositiveQuantity(input.quantity);
            const product = this.requireProduct(productId);
            if (String(product.type).toUpperCase() === 'SERVICE') {
                return { totalCost: 0, unitCost: 0, components: [] as { productId: number; quantity: number; issuedCost: number }[] };
            }

            const components = getRecipeComponents(this.db, productId);
            if (components.length === 0) {
                const out = this.stockOutCore({
                    branchId,
                    productId,
                    quantity,
                    type: 'SALE',
                    referenceId: input.referenceId,
                    description: `Sale ${input.referenceId}`,
                    date: input.date,
                    createdBy: input.createdBy ?? null,
                    allowNegativeStock: input.allowNegativeStock
                });
                return {
                    totalCost: out.issuedCost,
                    unitCost: quantity > 0 ? out.issuedCost / quantity : 0,
                    components: [{ productId, quantity, issuedCost: out.issuedCost }]
                };
            }

            const consumed: { productId: number; quantity: number; issuedCost: number }[] = [];
            let totalCost = 0;
            for (const component of components) {
                const wasteMultiplier = 1 + ((component.waste_percent || 0) / 100);
                const componentQuantity = component.quantity * quantity * wasteMultiplier;
                const out = this.stockOutCore({
                    branchId,
                    productId: component.ingredient_id,
                    quantity: componentQuantity,
                    type: 'RECIPE_CONSUMPTION',
                    referenceId: input.referenceId,
                    description: `Recipe consumption for product ${productId}`,
                    date: input.date,
                    createdBy: input.createdBy ?? null,
                    allowNegativeStock: input.allowNegativeStock
                });
                totalCost += out.issuedCost;
                consumed.push({ productId: component.ingredient_id, quantity: componentQuantity, issuedCost: out.issuedCost });
            }

            return {
                totalCost,
                unitCost: quantity > 0 ? totalCost / quantity : 0,
                components: consumed
            };
        });
    }

    createMovement(movement: InventoryMovementInput) {
        return this.runAtomic(() => {
            const type = this.normalizeMovementType(movement.type);
            const branchId = this.resolveBranchId(movement.branch_id);
            const productId = this.normalizeId(movement.product_id, 'productId');
            const quantity = this.requireNonZeroQuantity(movement.quantity);
            const common = {
                branchId,
                productId,
                referenceId: movement.reference_id ?? `${type}-${crypto.randomUUID()}`,
                description: movement.description,
                reason: movement.reason,
                date: movement.date,
                createdBy: movement.created_by ?? null
            };

            if (type === 'IN' || type === 'PURCHASE' || type === 'TRANSFER_IN' || type === 'OPENING_BALANCE') {
                return this.stockInCore({ ...common, quantity: Math.abs(quantity), unitCost: movement.unit_cost ?? null, type });
            }
            if (type === 'OUT' || type === 'SALE' || type === 'TRANSFER_OUT' || type === 'RECIPE_CONSUMPTION') {
                return this.stockOutCore({ ...common, quantity: Math.abs(quantity), type });
            }
            if (type === 'RETURN') {
                return this.stockInCore({ ...common, quantity: Math.abs(quantity), unitCost: movement.unit_cost ?? null, type });
            }
            return this.adjustStock({
                ...common,
                quantityDelta: quantity,
                unitCost: movement.unit_cost ?? null,
                reason: movement.reason || 'Inventory adjustment'
            });
        });
    }

    createTransfer(data: TransferInput, userId?: number) {
        return this.transferStock({
            fromBranchId: data.from_branch_id,
            toBranchId: data.to_branch_id,
            items: [{ productId: data.product_id, quantity: data.quantity }],
            reason: data.reason,
            referenceId: data.reference_id,
            description: data.description,
            date: data.date,
            createdBy: userId ?? null
        });
    }

    listMovements(filters: MovementFilters = {}) {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 50;
        const offset = (page - 1) * pageSize;
        const clauses: string[] = [];
        const params: any[] = [];

        if (filters.startDate) {
            clauses.push('m.date >= ?');
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            clauses.push('m.date <= ?');
            params.push(filters.endDate);
        }
        if (filters.type) {
            clauses.push('m.type = ?');
            params.push(filters.type);
        }
        if (filters.branchId) {
            clauses.push('m.branch_id = ?');
            params.push(filters.branchId);
        }
        if (filters.productId) {
            clauses.push('m.product_id = ?');
            params.push(filters.productId);
        }

        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

        const countRow = this.db.prepare(`
            SELECT COUNT(*) as count
            FROM inventory_movements m
            ${whereClause}
        `).get(...params) as { count: number };

        const items = this.db.prepare(`
            SELECT m.*, p.name as product_name, b.name as branch_name, u.username as created_by_name
            FROM inventory_movements m
            JOIN products p ON p.id = m.product_id
            LEFT JOIN branches b ON b.id = m.branch_id
            LEFT JOIN users u ON u.id = m.created_by
            ${whereClause}
            ORDER BY m.date DESC
            LIMIT ? OFFSET ?
        `).all(...params, pageSize, offset);

        return { items, total: countRow.count || 0, page, pageSize };
    }

    listInventoryItems(filters: InventoryItemFilters = {}) {
        const page = filters.page || 1;
        const pageSize = filters.pageSize || 20;
        const offset = (page - 1) * pageSize;
        const clauses: string[] = [];
        const params: any[] = [];

        const search = (filters.search || '').trim();
        const useSearch = search.length >= 2;
        if (useSearch) {
            const query = search.split(/\s+/).map(term => `${term}*`).join(' ');
            clauses.push('products_fts MATCH ?');
            params.push(query);
        }
        if (filters.categoryId) {
            clauses.push('p.category_id = ?');
            params.push(filters.categoryId);
        }
        if (typeof filters.isActive === 'boolean') {
            clauses.push('p.is_active = ?');
            params.push(filters.isActive ? 1 : 0);
        }

        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const joinSearch = useSearch ? 'JOIN products_fts fts ON p.id = fts.rowid' : '';
        const stockClause = filters.branchId ? 'WHERE branch_id = ?' : '';
        const stockParams = filters.branchId ? [filters.branchId] : [];

        const countRow = this.db.prepare(`
            SELECT COUNT(*) as count
            FROM products p
            ${joinSearch}
            ${whereClause}
        `).get(...params) as { count: number };

        const items = this.db.prepare(`
            SELECT p.*, c.name as category_name, u.name as unit_name, u.abbreviation as unit_abbr,
                   COALESCE(stock.on_hand, 0) as on_hand,
                   COALESCE(stock.average_cost, p.cost, 0) as average_cost
            FROM products p
            ${joinSearch}
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN units u ON u.id = p.unit_id
            LEFT JOIN (
                SELECT
                    product_id,
                    SUM(quantity_on_hand) as on_hand,
                    CASE
                        WHEN SUM(quantity_on_hand) > 0 THEN
                            SUM(quantity_on_hand * average_cost) / SUM(quantity_on_hand)
                        ELSE 0
                    END as average_cost
                FROM inventory_stock
                ${stockClause}
                GROUP BY product_id
            ) stock ON stock.product_id = p.id
            ${whereClause}
            ORDER BY p.name
            LIMIT ? OFFSET ?
        `).all(...stockParams, ...params, pageSize, offset);

        return { items, total: countRow.count || 0, page, pageSize };
    }

    getLowStockAlerts(branchId?: number, thresholdOverride?: number) {
        const settings = this.getInventorySettings();
        const threshold = thresholdOverride ?? settings.lowStockThresholdGlobal ?? 0;
        const stockClause = branchId ? 'WHERE branch_id = ?' : '';
        const stockParams = branchId ? [branchId] : [];

        const items = this.db.prepare(`
            SELECT p.*, c.name as category_name, u.name as unit_name, u.abbreviation as unit_abbr,
                   COALESCE(stock.on_hand, 0) as on_hand,
                   COALESCE(p.min_stock_level, ?) as threshold
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN units u ON u.id = p.unit_id
            LEFT JOIN (
                SELECT product_id, SUM(quantity_on_hand) as on_hand
                FROM inventory_stock
                ${stockClause}
                GROUP BY product_id
            ) stock ON stock.product_id = p.id
            WHERE p.is_active = 1
              AND COALESCE(stock.on_hand, 0) <= COALESCE(p.min_stock_level, ?)
            ORDER BY on_hand ASC, p.name
        `).all(threshold, ...stockParams, threshold);

        return { items, threshold };
    }

    processSale(productId: number, quantity: number, orderId: string, branchId?: number, userId?: number, allowNegativeStock?: boolean) {
        return this.consumeRecipe({
            branchId: branchId ?? null,
            productId,
            quantity,
            referenceId: orderId,
            createdBy: userId ?? null,
            allowNegativeStock
        });
    }

    processReturn(productId: number, quantity: number, referenceId: string, branchId?: number, userId?: number, unitCost?: number) {
        const recipeItems = getRecipeComponents(this.db, productId);
        if (recipeItems.length > 0) {
            return { totalCost: 0, unitCost: 0, movementId: null };
        }
        const returnUnitCost = unitCost ?? this.getStockLevel({ branchId: branchId ?? null, productId }).averageCost;
        const result = this.returnStock({
            branchId: branchId ?? null,
            productId,
            quantity,
            unitCost: returnUnitCost,
            referenceId,
            description: `Return ${referenceId}`,
            createdBy: userId ?? null
        });
        return {
            totalCost: quantity * returnUnitCost,
            unitCost: returnUnitCost,
            movementId: result.movementId
        };
    }

    rebuildStockSnapshot(): RebuildStockSnapshotResult {
        return this.runAtomic(() => {
            const warnings: string[] = [];
            const touchedProductIds = new Set<number>();
            clearStockSnapshot(this.db);

            for (const movement of listMovementsForRebuild(this.db)) {
                const type = this.normalizeMovementType(movement.type);
                const branchId = this.resolveBranchId(movement.branch_id);
                const productId = this.normalizeId(movement.product_id, 'productId');
                const product = this.requireProduct(productId);
                const current = getStockRow(this.db, branchId, productId);
                const currentQuantity = current?.quantity_on_hand ?? 0;
                const currentAverageCost = current?.average_cost ?? product.cost ?? 0;
                const absoluteQuantity = Math.abs(movement.quantity);

                if (absoluteQuantity === 0) {
                    warnings.push(`Skipped zero-quantity movement ${movement.id}`);
                    continue;
                }

                if (['IN', 'PURCHASE', 'RETURN', 'TRANSFER_IN', 'OPENING_BALANCE'].includes(type)) {
                    const unitCost = movement.unit_cost ?? currentAverageCost;
                    const nextAverageCost = this.applyCosting(currentQuantity, currentAverageCost, absoluteQuantity, unitCost);
                    upsertStockRow(this.db, branchId, productId, currentQuantity + absoluteQuantity, nextAverageCost);
                    touchedProductIds.add(productId);
                    continue;
                }

                if (['OUT', 'SALE', 'TRANSFER_OUT', 'RECIPE_CONSUMPTION'].includes(type)) {
                    upsertStockRow(this.db, branchId, productId, currentQuantity - absoluteQuantity, currentAverageCost);
                    touchedProductIds.add(productId);
                    continue;
                }

                if (type === 'ADJUST' || type === 'ADJUSTMENT') {
                    const signedQuantity = movement.quantity;
                    if (signedQuantity > 0) {
                        const unitCost = movement.unit_cost ?? currentAverageCost;
                        const nextAverageCost = this.applyCosting(currentQuantity, currentAverageCost, signedQuantity, unitCost);
                        upsertStockRow(this.db, branchId, productId, currentQuantity + signedQuantity, nextAverageCost);
                    } else {
                        upsertStockRow(this.db, branchId, productId, currentQuantity + signedQuantity, currentAverageCost);
                    }
                    touchedProductIds.add(productId);
                    continue;
                }

                const message = `Unsupported movement ${movement.id} with type ${movement.type}`;
                warnings.push(message);
                throw new Error(message);
            }

            for (const productId of touchedProductIds) {
                syncLegacyProductStock(this.db, productId);
            }
            for (const productId of listProductIdsWithStock(this.db)) {
                syncLegacyProductStock(this.db, productId);
            }

            const row = this.db.prepare('SELECT COUNT(*) as count FROM inventory_stock').get() as { count: number };
            return { rebuiltRows: row.count || 0, warnings };
        });
    }
}

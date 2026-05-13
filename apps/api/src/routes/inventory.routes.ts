import { FastifyInstance } from 'fastify';
import { InventoryService } from '../services/inventoryService';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { PERMISSIONS } from '../config/permissions';

type AuthenticatedUserContext = {
    userId?: number;
    branchId?: number | null;
};

const getRequestUser = (request: unknown): AuthenticatedUserContext | undefined => {
    return (request as { user?: AuthenticatedUserContext }).user;
};

const getErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error);
};

const toOptionalString = (value: unknown): string | undefined => {
    if (value === undefined || value === null || value === '') return undefined;
    return String(value);
};

const toIdInput = (value: unknown, fallback: string | number | null = null): string | number | null => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'number' || typeof value === 'string') return value;
    return String(value);
};

export async function inventoryRoutes(fastify: FastifyInstance) {
    const inventoryService = new InventoryService(getDB());

    fastify.get('/inventory/products', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_VIEW)]
    }, async (request) => {
        const query = request.query as any;
        const isActive = query.isActive === undefined ? undefined : ['true', '1', 'yes'].includes(String(query.isActive).toLowerCase());
        return inventoryService.getProducts({
            search: query.search || '',
            categoryId: query.categoryId ? Number(query.categoryId) : undefined,
            isActive,
            page: query.page ? Number(query.page) : 1,
            pageSize: query.pageSize ? Number(query.pageSize) : 20
        });
    });

    fastify.get('/inventory/items', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_VIEW)]
    }, async (request) => {
        const query = request.query as any;
        const isActive = query.isActive === undefined ? undefined : ['true', '1', 'yes'].includes(String(query.isActive).toLowerCase());
        return inventoryService.listInventoryItems({
            search: query.search || '',
            categoryId: query.categoryId ? Number(query.categoryId) : undefined,
            isActive,
            branchId: query.branchId ? Number(query.branchId) : undefined,
            page: query.page ? Number(query.page) : 1,
            pageSize: query.pageSize ? Number(query.pageSize) : 20
        });
    });

    fastify.get('/inventory/stock', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_VIEW)]
    }, async (request, reply) => {
        try {
            const query = request.query as Record<string, unknown>;
            const productId = query.productId ?? query.product_id;
            if (!productId) {
                reply.status(400).send({ error: 'productId is required.' });
                return;
            }
            return inventoryService.getStockLevel({
                branchId: toIdInput(query.branchId ?? query.branch_id),
                productId: Number(productId)
            });
        } catch (error: unknown) {
            reply.status(400).send({ error: getErrorMessage(error) });
        }
    });

    fastify.get('/inventory/products/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_VIEW)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const product = inventoryService.getProductById(Number(id));
        if (!product) {
            reply.status(404).send({ error: 'Product not found' });
            return;
        }
        return product;
    });

    fastify.post('/inventory/products', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_CREATE), auditAction('Inventory.CreateProduct')]
    }, async (request, reply) => {
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.createProduct({
                name: body.name,
                sku: body.sku,
                type: body.type,
                price: Number(body.price || 0),
                description: body.description,
                min_stock_level: body.min_stock_level ? Number(body.min_stock_level) : null,
                category_id: body.category_id ? Number(body.category_id) : null,
                unit_id: body.unit_id ? Number(body.unit_id) : null,
                base_unit_id: body.base_unit_id ? Number(body.base_unit_id) : body.unit_id ? Number(body.unit_id) : null,
                is_active: body.is_active !== undefined ? body.is_active : 1
            }, user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.put('/inventory/products/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.UpdateProduct')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.updateProduct(Number(id), {
                name: body.name,
                sku: body.sku,
                type: body.type,
                price: Number(body.price || 0),
                description: body.description,
                min_stock_level: body.min_stock_level ? Number(body.min_stock_level) : null,
                category_id: body.category_id ? Number(body.category_id) : null,
                unit_id: body.unit_id ? Number(body.unit_id) : null,
                base_unit_id: body.base_unit_id ? Number(body.base_unit_id) : body.unit_id ? Number(body.unit_id) : null,
                is_active: body.is_active !== undefined ? body.is_active : 1
            }, user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/inventory/products/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.ArchiveProduct')]
    }, async (request) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        return inventoryService.archiveProduct(Number(id), user?.userId);
    });

    fastify.get('/inventory/products/:id/recipe', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_VIEW)]
    }, async (request) => {
        const { id } = request.params as { id: string };
        return inventoryService.getRecipe(Number(id));
    });

    fastify.put('/inventory/products/:id/recipe', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.UpdateRecipe')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.replaceRecipe(Number(id), Array.isArray(body.items) ? body.items : [], user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/inventory/categories', {
        preHandler: [authenticate, requireAnyPermission([PERMISSIONS.PRD_VIEW, PERMISSIONS.POS_SALE])]
    }, async () => {
        return { items: inventoryService.listCategories() };
    });

    fastify.post('/inventory/categories', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.CreateCategory')]
    }, async (request, reply) => {
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.createCategory({ name: body.name, description: body.description }, user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.put('/inventory/categories/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.UpdateCategory')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.updateCategory(Number(id), {
                name: body.name,
                description: body.description,
                is_active: body.is_active
            }, user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/inventory/categories/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.ArchiveCategory')]
    }, async (request) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        return inventoryService.archiveCategory(Number(id), user?.userId);
    });

    fastify.get('/inventory/units', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_VIEW)]
    }, async () => {
        return { items: inventoryService.listUnits() };
    });

    fastify.post('/inventory/units', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.CreateUnit')]
    }, async (request, reply) => {
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.createUnit({ name: body.name, abbreviation: body.abbreviation }, user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.put('/inventory/units/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.UpdateUnit')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.updateUnit(Number(id), {
                name: body.name,
                abbreviation: body.abbreviation,
                is_active: body.is_active
            }, user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/inventory/units/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.ArchiveUnit')]
    }, async (request) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        return inventoryService.archiveUnit(Number(id), user?.userId);
    });

    fastify.get('/inventory/units/conversions', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_VIEW)]
    }, async () => {
        return { items: inventoryService.listUnitConversions() };
    });

    fastify.post('/inventory/units/conversions', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.UpsertUnitConversion')]
    }, async (request, reply) => {
        const user = request.user;
        const body = request.body as any;
        try {
            return inventoryService.upsertUnitConversion({
                from_unit_id: Number(body.from_unit_id),
                to_unit_id: Number(body.to_unit_id),
                multiplier: Number(body.multiplier)
            }, user?.userId);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/inventory/units/conversions/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.DeleteUnitConversion')]
    }, async (request) => {
        const { id } = request.params as { id: string };
        return inventoryService.deleteUnitConversion(Number(id));
    });

    fastify.post('/inventory/movements', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_ADJUST), auditAction('Inventory.Adjust')]
    }, async (request, reply) => {
        try {
            const user = request.user;
            const body = request.body as any;
            const type = String(body.type || '').toUpperCase();
            if (!['IN', 'OUT', 'ADJUST'].includes(type)) {
                reply.status(400).send({ error: 'Unsupported movement type. Use IN, OUT, or ADJUST.' });
                return;
            }
            if (type === 'ADJUST' && !body.reason) {
                reply.status(400).send({ error: 'Reason is required for adjustments.' });
                return;
            }
            const quantity = Number(body.quantity || 0);
            if (!quantity) {
                reply.status(400).send({ error: 'Quantity must be greater than zero.' });
                return;
            }
            return inventoryService.createMovement({
                date: body.date || new Date().toISOString(),
                type: type as 'IN' | 'OUT' | 'ADJUST',
                product_id: Number(body.product_id),
                quantity: type === 'ADJUST' ? quantity : Math.abs(quantity),
                unit_cost: body.unit_cost !== undefined && body.unit_cost !== null ? Number(body.unit_cost) : undefined,
                reference_id: body.reference_id,
                source_type: body.source_type,
                entered_unit_id: body.entered_unit_id ? Number(body.entered_unit_id) : undefined,
                entered_quantity: body.entered_quantity !== undefined ? Number(body.entered_quantity) : undefined,
                description: body.description,
                reason: body.reason,
                branch_id: body.branch_id ? Number(body.branch_id) : user?.branchId ?? null,
                created_by: user?.userId ?? null
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.post('/inventory/adjustments', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_ADJUST), auditAction('Inventory.Adjust')]
    }, async (request, reply) => {
        try {
            const user = getRequestUser(request);
            const body = request.body as Record<string, unknown>;
            const quantityDelta = Number(body.quantityDelta ?? body.quantity_delta ?? 0);
            if (!quantityDelta) {
                reply.status(400).send({ error: 'quantityDelta must be non-zero.' });
                return;
            }
            if (!body.reason) {
                reply.status(400).send({ error: 'Reason is required for adjustments.' });
                return;
            }
            const reasonText = String(body.reason);
            return inventoryService.adjustStock({
                branchId: toIdInput(body.branchId ?? body.branch_id, user?.branchId ?? null),
                productId: Number(body.productId ?? body.product_id),
                quantityDelta,
                unitCost: body.unitCost !== undefined && body.unitCost !== null
                    ? Number(body.unitCost)
                    : body.unit_cost !== undefined && body.unit_cost !== null
                        ? Number(body.unit_cost)
                        : null,
                reason: reasonText,
                referenceId: toOptionalString(body.referenceId ?? body.reference_id),
                sourceType: toOptionalString(body.sourceType ?? body.source_type),
                enteredUnitId: body.enteredUnitId !== undefined ? Number(body.enteredUnitId) : body.entered_unit_id !== undefined ? Number(body.entered_unit_id) : undefined,
                enteredQuantity: body.enteredQuantity !== undefined ? Number(body.enteredQuantity) : body.entered_quantity !== undefined ? Number(body.entered_quantity) : undefined,
                description: toOptionalString(body.description),
                createdBy: user?.userId ?? null
            });
        } catch (error: unknown) {
            reply.status(400).send({ error: getErrorMessage(error) });
        }
    });

    fastify.get('/inventory/movements', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_VIEW)]
    }, async (request) => {
        const query = request.query as any;
        return inventoryService.listMovements({
            startDate: query.startDate || query.from,
            endDate: query.endDate || query.to,
            type: query.type ? String(query.type).toUpperCase() : undefined,
            branchId: query.branchId ? Number(query.branchId) : undefined,
            productId: query.productId ? Number(query.productId) : undefined,
            page: query.page ? Number(query.page) : 1,
            pageSize: query.pageSize ? Number(query.pageSize) : 50
        });
    });

    fastify.post('/inventory/transfers', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_TRANSFER), auditAction('Inventory.Transfer')]
    }, async (request, reply) => {
        try {
            const user = getRequestUser(request);
            const body = request.body as Record<string, unknown>;
            const reason = body.reason || body.notes || body.description;
            if (!reason) {
                reply.status(400).send({ error: 'Reason is required for transfers.' });
                return;
            }
            const fromBranchId = body.fromBranchId ?? body.from_branch_id;
            const toBranchId = body.toBranchId ?? body.to_branch_id;
            if (!fromBranchId || !toBranchId || Number(fromBranchId) === Number(toBranchId)) {
                reply.status(400).send({ error: 'Transfer requires different source and destination branches.' });
                return;
            }
            const rawItems: Record<string, unknown>[] = Array.isArray(body.items)
                ? body.items.map(item => item as Record<string, unknown>)
                : [{ productId: body.productId ?? body.product_id, quantity: body.quantity }];
            const items = rawItems.map(item => ({
                productId: Number(item.productId ?? item.product_id),
                quantity: Number(item.quantity)
            }));
            return inventoryService.transferStock({
                fromBranchId: Number(fromBranchId),
                toBranchId: Number(toBranchId),
                items,
                reason: String(reason),
                referenceId: toOptionalString(body.referenceId ?? body.reference_id),
                description: toOptionalString(body.description ?? body.notes),
                date: toOptionalString(body.date),
                createdBy: user?.userId ?? null
            });
        } catch (error: unknown) {
            reply.status(400).send({ error: getErrorMessage(error) });
        }
    });

    fastify.post('/inventory/rebuild-snapshot', {
        preHandler: [
            authenticate,
            requireAnyPermission([PERMISSIONS.INV_ADJUST, PERMISSIONS.SET_MANAGE_SETTINGS]),
            auditAction('Inventory.RebuildSnapshot')
        ]
    }, async (request, reply) => {
        try {
            return inventoryService.rebuildStockSnapshot();
        } catch (error: unknown) {
            reply.status(400).send({ error: getErrorMessage(error) });
        }
    });

    fastify.get('/inventory/alerts/low-stock', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_VIEW)]
    }, async (request) => {
        const query = request.query as any;
        const branchId = query.branchId ? Number(query.branchId) : undefined;
        const threshold = query.threshold ? Number(query.threshold) : undefined;
        return inventoryService.getLowStockAlerts(branchId, threshold);
    });
}

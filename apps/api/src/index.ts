import Fastify from 'fastify';
import cors from '@fastify/cors';
import z from 'zod';
import { HealthCheckSchema, JournalEntrySchema } from '@dms/shared';
import { initDB } from './database';
import { AccountingService } from './services/accountingService';
import { InventoryService } from './services/inventoryService';
import { PrintingService } from './services/printingService';
import { ReportingService } from './services/reportingService';
import { SettingsService } from './services/settingsService';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { posRoutes } from './routes/pos.routes';
import { insightRoutes } from './routes/insights';
import userRoutes from './routes/user.routes';
import { backupRoutes } from './routes/backup.routes';
import { invoiceRoutes } from './routes/invoice.routes';
import { deliveryCourierRoutes } from './routes/deliveryCourier.routes';
import { authenticate } from './middleware/auth';
import { requireAnyPermission, requirePermission } from './middleware/rbac';
import { auditAction } from './middleware/audit';
import { PERMISSIONS } from './config/permissions';
import { getCorsOrigins } from './config/security';

const fastify = Fastify({
    logger: true
});

fastify.register(cors, {
    origin: getCorsOrigins()
});

const db = initDB();
(fastify as any).db = db;
const accountingService = new AccountingService(db);
const inventoryService = new InventoryService(db);
const printingService = new PrintingService(db);
const reportingService = new ReportingService(db);
const settingsService = new SettingsService(db);

const UserSettingsSchema = z.object({
    language: z.enum(['en', 'ar']).optional()
});

const parseUserSettings = (value?: string | null) => {
    if (!value) return {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
};

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

// Register Auth & Admin Routes
fastify.register(authRoutes);
fastify.register(adminRoutes);
fastify.register(posRoutes);
fastify.register(insightRoutes);
fastify.register(userRoutes);
fastify.register(backupRoutes);
fastify.register(invoiceRoutes);
fastify.register(deliveryCourierRoutes);
// Register printing routes
fastify.register((fastify, opts, done) => {
    import('./routes/printing.routes').then(({ printingRoutes }) => {
        fastify.register(printingRoutes, { prefix: '/printing' });
        done();
    });
});

fastify.get('/', async (request, reply) => {
    return { hello: 'world' };
});

fastify.get('/health', async (request, reply) => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString()
    };
});

// --- User Settings ---

fastify.get('/users/me/settings', {
    preHandler: [authenticate]
}, async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
        reply.status(401).send({ error: 'Unauthorized' });
        return;
    }
    const row = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as { settings?: string | null } | undefined;
    return parseUserSettings(row?.settings);
});

fastify.put('/users/me/settings', {
    preHandler: [authenticate]
}, async (request, reply) => {
    const userId = request.user?.userId;
    if (!userId) {
        reply.status(401).send({ error: 'Unauthorized' });
        return;
    }
    const body = UserSettingsSchema.parse(request.body || {});
    const row = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as { settings?: string | null } | undefined;
    const current = parseUserSettings(row?.settings);
    const nextSettings = { ...current, ...body };
    db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(nextSettings), userId);
    return nextSettings;
});

// --- Accounting Routes ---

fastify.post('/accounting/accounts', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_EDIT_COA)]
}, async (request, reply) => {
    try {
        const body = request.body as any;
        return accountingService.createAccount({
            code: body.code,
            name: body.name,
            type: body.type,
            parent_id: body.parent_id ?? null,
            is_active: body.is_active ?? 1,
            branch_id: body.branch_id ?? null
        });
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.get('/accounting/accounts', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_COA)]
}, async (request) => {
    const query = request.query as any;
    const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
    return { items: accountingService.listAccounts(query.search, Number.isNaN(branchId) ? undefined : branchId) };
});

fastify.put('/accounting/accounts/:id', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_EDIT_COA)]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
        return accountingService.updateAccount(Number(id), {
            code: body.code,
            name: body.name,
            type: body.type,
            parent_id: body.parent_id ?? null,
            is_active: body.is_active ?? 1
        });
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.delete('/accounting/accounts/:id', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_EDIT_COA)]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
        return accountingService.deleteAccount(Number(id));
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.post('/accounting/entries', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_CREATE_JOURNAL), auditAction('Accounting.CreateEntry')]
}, async (request, reply) => {
    try {
        const body = request.body as any;
        const user = (request as any).user;
        if (!body.lines || body.lines.length < 2) {
            reply.status(400).send({ error: 'At least two lines are required.' });
            return;
        }
        const entry = accountingService.createJournalEntry({
            date: body.date,
            description: body.description,
            source_type: body.source_type || 'MANUAL',
            source_id: body.source_id,
            branch_id: user?.branchId ?? null,
            lines: body.lines
        }, { allowUnbalanced: Boolean(body.allowUnbalanced) });
        return entry;
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.post('/accounting/entries/:id/post', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_POST_JOURNAL), auditAction('Accounting.PostEntry')]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    try {
        accountingService.postEntry(id, user?.userId);
        return { success: true };
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.get('/accounting/reports/trial-balance', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
}, async (request) => {
    const query = request.query as any;
    const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
    return accountingService.getTrialBalance({
        startDate: query.startDate,
        endDate: query.endDate,
        branchId: Number.isNaN(branchId) ? undefined : branchId
    });
});

fastify.get('/accounting/reports/ledger', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
}, async (request, reply) => {
    const query = request.query as any;
    const accountId = Number(query.accountId);
    if (!accountId || Number.isNaN(accountId)) {
        reply.status(400).send({ error: 'accountId is required.' });
        return;
    }
    const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
    try {
        return accountingService.getLedgerReport({
            accountId,
            startDate: query.startDate,
            endDate: query.endDate,
            branchId: Number.isNaN(branchId) ? undefined : branchId,
            sourceType: query.sourceType
        });
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.get('/accounting/entries', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
}, async (request, reply) => {
    const query = request.query as any;
    const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
    return {
        items: accountingService.listJournalEntries({
            status: query.status === 'draft' || query.status === 'posted' ? query.status : undefined,
            startDate: query.startDate,
            endDate: query.endDate,
            search: query.search,
            branchId: Number.isNaN(branchId) ? undefined : branchId
        })
    };
});

fastify.get('/accounting/entries/:id', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const entry = accountingService.getJournalEntry(id);
    if (!entry) {
        reply.status(404).send({ error: 'Entry not found' });
        return;
    }
    return entry;
});

fastify.put('/accounting/entries/:id', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_CREATE_JOURNAL), auditAction('Accounting.UpdateEntry')]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    try {
        if (!body.lines || body.lines.length < 2) {
            reply.status(400).send({ error: 'At least two lines are required.' });
            return;
        }
        return accountingService.updateJournalEntry(id, {
            date: body.date,
            description: body.description,
            lines: body.lines
        });
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.post('/accounting/entries/:id/reverse', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_REVERSE_JOURNAL), auditAction('Accounting.ReverseEntry')]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    try {
        const reversal = accountingService.reverseEntry(id, user?.userId);
        return { id: reversal.id };
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

// --- Inventory Routes ---

fastify.get('/inventory/products', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_VIEW)]
}, async (request, reply) => {
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
    const user = (request as any).user;
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
    const user = (request as any).user;
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
            is_active: body.is_active !== undefined ? body.is_active : 1
        }, user?.userId);
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.delete('/inventory/products/:id', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.ArchiveProduct')]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
    return inventoryService.archiveProduct(Number(id), user?.userId);
});

fastify.get('/inventory/products/:id/recipe', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_VIEW)]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    return inventoryService.getRecipe(Number(id));
});

fastify.put('/inventory/products/:id/recipe', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.PRD_EDIT), auditAction('Inventory.UpdateRecipe')]
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
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
    const user = (request as any).user;
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
    const user = (request as any).user;
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
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
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
    const user = (request as any).user;
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
    const user = (request as any).user;
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
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = (request as any).user;
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
    const user = (request as any).user;
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
}, async (request, reply) => {
    const { id } = request.params as { id: string };
    return inventoryService.deleteUnitConversion(Number(id));
});

fastify.post('/inventory/movements', {
    preHandler: [authenticate, requirePermission(PERMISSIONS.INV_ADJUST), auditAction('Inventory.Adjust')]
}, async (request, reply) => {
    try {
        const user = (request as any).user;
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

fastify.get('/branches', {
    preHandler: [authenticate, requireAnyPermission([
        PERMISSIONS.INV_VIEW,
        PERMISSIONS.ACC_VIEW_REPORTS,
        PERMISSIONS.RPT_VIEW,
        PERMISSIONS.SET_MANAGE_PRINTERS
    ])]
}, async () => {
    const items = db.prepare('SELECT id, name FROM branches ORDER BY name').all();
    return { items };
});

// --- Reporting Routes ---

fastify.get('/reports/dashboard', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate } = request.query as { startDate: string, endDate: string };
    if (!startDate || !endDate) {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
        return reportingService.getDashboardStats(start, end);
    }
    return reportingService.getDashboardStats(startDate, endDate);
});

fastify.get('/reports/daily-sales', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate } = request.query as { startDate: string, endDate: string };
    return reportingService.getDailySales(startDate || '2020-01-01', endDate || new Date().toISOString());
});

fastify.get('/reports/sales', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate, branchId, groupBy } = request.query as { startDate: string; endDate: string; branchId?: string; groupBy?: string };
    if (!startDate || !endDate) {
        reply.status(400).send({ error: 'startDate and endDate are required' });
        return;
    }
    return reportingService.getSalesReport({
        startDate,
        endDate,
        branchId: branchId ? Number(branchId) : undefined,
        groupBy
    });
});

fastify.get('/reports/sales/transactions', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate, branchId, groupBy, key } = request.query as {
        startDate: string;
        endDate: string;
        branchId?: string;
        groupBy?: string;
        key?: string;
    };
    if (!startDate || !endDate || !groupBy || !key) {
        reply.status(400).send({ error: 'startDate, endDate, groupBy, and key are required' });
        return;
    }
    return reportingService.getSalesTransactions({
        startDate,
        endDate,
        branchId: branchId ? Number(branchId) : undefined,
        groupBy,
        key
    });
});

fastify.get('/reports/margins', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate, branchId, groupBy } = request.query as { startDate: string; endDate: string; branchId?: string; groupBy?: string };
    if (!startDate || !endDate) {
        reply.status(400).send({ error: 'startDate and endDate are required' });
        return;
    }
    return reportingService.getMarginReport({
        startDate,
        endDate,
        branchId: branchId ? Number(branchId) : undefined,
        groupBy
    });
});

fastify.get('/reports/margins/transactions', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate, branchId, groupBy, key } = request.query as {
        startDate: string;
        endDate: string;
        branchId?: string;
        groupBy?: string;
        key?: string;
    };
    if (!startDate || !endDate || !groupBy || !key) {
        reply.status(400).send({ error: 'startDate, endDate, groupBy, and key are required' });
        return;
    }
    return reportingService.getMarginTransactions({
        startDate,
        endDate,
        branchId: branchId ? Number(branchId) : undefined,
        groupBy,
        key
    });
});

fastify.get('/reports/sessions-z', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate, branchId } = request.query as { startDate: string; endDate: string; branchId?: string };
    if (!startDate || !endDate) {
        reply.status(400).send({ error: 'startDate and endDate are required' });
        return;
    }
    return reportingService.getSessionsReport({
        startDate,
        endDate,
        branchId: branchId ? Number(branchId) : undefined
    });
});

fastify.get('/reports/sessions-z/orders', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { sessionId } = request.query as { sessionId?: string };
    if (!sessionId) {
        reply.status(400).send({ error: 'sessionId is required' });
        return;
    }
    return reportingService.getSessionOrders({ sessionId });
});

fastify.get('/reports/inventory', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate, branchId, groupBy } = request.query as { startDate: string; endDate: string; branchId?: string; groupBy?: string };
    if (!startDate || !endDate) {
        reply.status(400).send({ error: 'startDate and endDate are required' });
        return;
    }
    return reportingService.getInventoryMovementsReport({
        startDate,
        endDate,
        branchId: branchId ? Number(branchId) : undefined,
        groupBy
    });
});

fastify.get('/reports/inventory/transactions', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS])]
}, async (request, reply) => {
    const { startDate, endDate, branchId, groupBy, key } = request.query as {
        startDate: string;
        endDate: string;
        branchId?: string;
        groupBy?: string;
        key?: string;
    };
    if (!startDate || !endDate || !groupBy || !key) {
        reply.status(400).send({ error: 'startDate, endDate, groupBy, and key are required' });
        return;
    }
    return reportingService.getInventoryMovementTransactions({
        startDate,
        endDate,
        branchId: branchId ? Number(branchId) : undefined,
        groupBy,
        key
    });
});

// --- Settings Routes ---

fastify.get('/settings/:category', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS, PERMISSIONS.POS_SALE])]
}, async (request, reply) => {
    const { category } = request.params as { category: string };
    return settingsService.getSettings(category);
});

fastify.get('/settings', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS, PERMISSIONS.POS_SALE])]
}, async (request, reply) => {
    return settingsService.getSettings('all');
});

fastify.put('/settings/:category', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS]), auditAction('Settings.Update')]
}, async (request, reply) => {
    const { category } = request.params as { category: string };
    const user = (request as any).user;
    try {
        settingsService.updateSettings(category, request.body, user.userId);
        return { success: true };
    } catch (error: any) {
        reply.status(400).send({ error: error.message });
    }
});

fastify.get('/settings/:category/history', {
    preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS])]
}, async (request, reply) => {
    const { category } = request.params as { category: string };
    return settingsService.getHistory(category);
});

// --- Background Tasks ---
setInterval(() => {
    printingService.processQueue(10).catch(err => {
        fastify.log.error('Background Printing Error:', err);
    });
}, 5000);

const start = async () => {
    try {
        const port = Number(process.env.DMS_PORT || 3000);
        const host = process.env.DMS_HOST || '0.0.0.0';
        await fastify.listen({ port, host });
        console.log(`API listening on http://${host}:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

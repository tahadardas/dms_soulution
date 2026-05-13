import { FastifyInstance } from 'fastify';
import { POSService } from '../services/pos.service';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { AuditService } from '../services/audit';
import { PERMISSIONS } from '../config/permissions';

export async function posRoutes(fastify: FastifyInstance) {
    const db = getDB();
    const service = new POSService(db);

    fastify.get('/pos/sessions/all', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_CLOSE_SESSION)]
    }, async (request, reply) => {
        return service.listAllOpenSessions();
    });

    fastify.post('/pos/sessions/open', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE), auditAction('POS.OpenSession')]
    }, async (request, reply) => {
        const body = request.body as any;
        const userId = (request as any).user?.userId || body.userId;
        if (!userId) {
            reply.status(400).send({ error: 'User is required to open a session.' });
            return;
        }
        const openingCash = Number(body.openingCash ?? 0);
        if (Number.isNaN(openingCash)) {
            reply.status(400).send({ error: 'Opening cash must be a number.' });
            return;
        }
        const branchId = body.branchId ?? (request as any).user?.branchId ?? null;
        try {
            const result = service.openSession({
                userId,
                branchId,
                openingCash,
                stationId: body.stationId
            });
            AuditService.log({
                userId,
                action: 'POS.SESSION_OPEN',
                branchId: (request as any).user?.branchId,
                details: { sessionId: result.id, openingCash }
            });
            return result;
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/pos/sessions/active', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE)]
    }, async (request, reply) => {
        const userId = (request as any).user?.userId;
        if (!userId) {
            reply.status(400).send({ error: 'User is required.' });
            return;
        }
        const stationId = (request.query as any).stationId;
        const session = service.getActiveSession(userId, stationId);
        return session || null;
    });

    fastify.post('/pos/sessions/close', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_CLOSE_SESSION), auditAction('POS.CloseSession')]
    }, async (request, reply) => {
        const body = request.body as any;
        const userId = (request as any).user?.userId;
        try {
            return await service.closeSession({
                sessionId: body.sessionId,
                closingCash: Number(body.closingCash),
                notes: body.notes,
                managerUsername: body.managerUsername,
                managerPassword: body.managerPassword,
                reason: body.reason,
                userId
            });
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/pos/orders', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE), auditAction('POS.CreateOrder')]
    }, async (request, reply) => {
        const body = request.body as any;
        const userId = (request as any).user?.userId || body.userId;
        try {
            const result = await service.submitOrder(body, userId);
            AuditService.log({
                userId,
                action: 'POS.ORDER_CREATE',
                branchId: (request as any).user?.branchId,
                details: { orderId: result.orderId, orderNumber: result.orderNumber, total: result.totalAmount }
            });
            return result;
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/pos/returns', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_RETURN_CREATE), auditAction('POS.Return')]
    }, async (request, reply) => {
        const body = request.body as any;
        const userId = (request as any).user?.userId || body.userId;
        try {
            const result = await service.createReturn(body, userId);
            AuditService.log({
                userId,
                action: 'POS.RETURN_CREATE',
                branchId: (request as any).user?.branchId,
                details: { returnId: result.returnId, totalRefund: result.totalRefund, reason: body.reason }
            });
            return result;
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/pos/returns', {
        preHandler: [authenticate, requireAnyPermission([PERMISSIONS.POS_RETURN_CREATE, PERMISSIONS.POS_RETURNS])]
    }, async (request, reply) => {
        const query = request.query as any;
        const page = Number(query.page || 1);
        const pageSize = Number(query.pageSize || 20);
        return service.listReturns(page, pageSize, query.sessionId);
    });

    fastify.get('/pos/sessions/:sessionId/stats', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE)]
    }, async (request, reply) => {
        const { sessionId } = request.params as any;
        return service.getSessionStats(sessionId);
    });

    fastify.post('/pos/cash-in', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_CASH_IN), auditAction('POS.CashIn')]
    }, async (request, reply) => {
        const body = request.body as any;
        const userId = (request as any).user?.userId;
        if (!userId) {
            reply.status(400).send({ error: 'User is required.' });
            return;
        }
        try {
            return await service.cashIn({
                sessionId: body.sessionId,
                amount: Number(body.amount),
                reason: body.reason,
                method: body.method || 'CASH'
            }, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/pos/cash-out', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_CASH_OUT), auditAction('POS.CashOut')]
    }, async (request, reply) => {
        const body = request.body as any;
        const userId = (request as any).user?.userId;
        if (!userId) {
            reply.status(400).send({ error: 'User is required.' });
            return;
        }
        try {
            return await service.cashOut({
                sessionId: body.sessionId,
                amount: Number(body.amount),
                reason: body.reason,
                method: body.method || 'CASH',
                managerUsername: body.managerUsername,
                managerPassword: body.managerPassword
            }, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/pos/products', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE)]
    }, async (request, reply) => {
        const query = request.query as any;
        const page = Number(query.page || 1);
        const pageSize = Number(query.pageSize || 20);
        const categoryId = query.categoryId ? Number(query.categoryId) : undefined;
        return service.getProducts(query.search || query.q || '', page, pageSize, categoryId);
    });

    fastify.get('/pos/orders/:orderId', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE)]
    }, async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const order = service.getOrder(orderId);
        if (!order) {
            reply.status(404).send({ error: 'Order not found' });
            return;
        }
        return order;
    });

    fastify.get('/pos/orders', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE)]
    }, async (request, reply) => {
        const query = request.query as any;
        const page = Number(query.page || 1);
        const pageSize = Number(query.pageSize || 20);
        return service.listOrders(query.orderNumber, page, pageSize, query.sessionId);
    });

    fastify.patch('/pos/orders/:orderId/lines/:lineId/note', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE), auditAction('POS.UpdateLineNote')]
    }, async (request, reply) => {
        const params = request.params as { orderId: string; lineId: string };
        const body = request.body as { note?: string };
        const userId = (request as any).user?.userId;

        const orderId = params.orderId;
        const lineId = Number(params.lineId);

        if (!orderId || Number.isNaN(lineId)) {
            reply.status(400).send({ error: 'Invalid order or line ID' });
            return;
        }

        try {
            const result = service.updateLineNote(orderId, lineId, body.note || '', userId);
            AuditService.log({
                userId,
                action: 'POS.ORDER_LINE_NOTE_EDITED',
                branchId: (request as any).user?.branchId,
                details: { orderId, lineId, note: body.note }
            });
            return result;
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/pos/orders/pending-delivery', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_SALE)]
    }, async (request, reply) => {
        const query = request.query as any;
        return service.listPendingDeliveryOrders({
            branchId: query.branchId ? Number(query.branchId) : undefined,
            sessionId: query.sessionId
        });
    });

    fastify.post('/pos/orders/:orderId/collect-delivery', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_DELIVERY_COLLECT), auditAction('POS.CollectDelivery')]
    }, async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const body = request.body as any;
        const userId = (request as any).user?.userId;
        if (!userId) {
            reply.status(400).send({ error: 'User is required.' });
            return;
        }
        try {
            const result = await service.collectDeliveryOrder(orderId, {
                amount: Number(body.amount),
                paymentMethod: body.paymentMethod || 'CASH',
                notes: body.notes,
                sessionId: body.sessionId
            }, userId);
            AuditService.log({
                userId,
                action: 'POS.DELIVERY_COLLECTED',
                branchId: (request as any).user?.branchId,
                details: { orderId, amount: body.amount }
            });
            return result;
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/pos/orders/:orderId/void', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_ORDER_VOID), auditAction('POS.VoidOrder')]
    }, async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const body = request.body as any;
        const userId = (request as any).user?.userId;
        try {
            return await service.voidOrder({
                orderId,
                reason: body.reason,
                managerUsername: body.managerUsername,
                managerPassword: body.managerPassword
            }, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/pos/orders/:orderId/reprint', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_ORDER_REPRINT), auditAction('POS.ReprintOrder')]
    }, async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const body = request.body as any;
        const userId = (request as any).user?.userId;
        try {
            return await service.reprintReceipt({
                orderId,
                reason: body.reason,
                managerUsername: body.managerUsername,
                managerPassword: body.managerPassword
            }, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/pos/orders/:orderId/print', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.POS_ORDER_PRINT), auditAction('POS.PrintOrder')]
    }, async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const body = request.body as any;
        const rawTypes = Array.isArray(body.types) && body.types.length > 0 ? body.types : ['RECEIPT'];
        const types = rawTypes.filter((type: string) => type === 'RECEIPT' || type === 'KOT') as Array<'RECEIPT' | 'KOT'>;
        if (types.length !== rawTypes.length) {
            reply.status(400).send({ error: 'Invalid print job type.' });
            return;
        }

        try {
            const jobs = service.printOrder(orderId, types);
            const processResult = body.processNow ? await service.processPrintQueue() : undefined;
            const jobDetails = service.getPrintJobs(jobs.map(job => job.id));
            const failedJobs = jobDetails.filter((job: any) => job.status === 'FAILED');
            if (failedJobs.length > 0) {
                reply.status(502).send({
                    success: false,
                    error: 'فشلت الطباعة. يرجى مراجعة حالة الطابعة أو إعادة المحاولة.',
                    orderId,
                    jobs: jobDetails,
                    processResult
                });
                return;
            }
            return { success: true, orderId, jobs: jobDetails, processResult };
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });
}

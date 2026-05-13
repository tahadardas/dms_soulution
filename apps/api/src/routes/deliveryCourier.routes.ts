import { FastifyInstance } from 'fastify';
import { DeliveryCourierService } from '../services/deliveryCourier.service';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { PERMISSIONS } from '../config/permissions';

export async function deliveryCourierRoutes(fastify: FastifyInstance) {
    const db = getDB();
    const service = new DeliveryCourierService(db);

    fastify.get('/delivery-couriers/search', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.DELIVERY_COURIER_VIEW)]
    }, async (request, reply) => {
        const { q, limit } = request.query as { q: string; limit?: string };
        return service.searchCouriers(q || '', limit ? Number(limit) : 10);
    });

    fastify.post('/delivery-couriers', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.DELIVERY_COURIER_CREATE), auditAction('Courier.Create')]
    }, async (request, reply) => {
        try {
            const userId = (request as any).user?.userId;
            return service.createCourier(request.body as any, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/delivery-couriers/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.DELIVERY_COURIER_VIEW)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const courier = service.getCourierById(Number(id));
        if (!courier) {
            reply.status(404).send({ error: 'Courier not found' });
            return;
        }
        return courier;
    });

    fastify.put('/delivery-couriers/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.DELIVERY_COURIER_UPDATE), auditAction('Courier.Update')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            const userId = (request as any).user?.userId;
            return service.updateCourier(Number(id), request.body as any, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/delivery-couriers/stats', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.DELIVERY_COURIER_REPORT)]
    }, async (request, reply) => {
        const filters = request.query as any;
        return service.getCourierStats({
            courierId: filters.courierId ? Number(filters.courierId) : undefined,
            branchId: filters.branchId ? Number(filters.branchId) : undefined,
            startDate: filters.startDate,
            endDate: filters.endDate
        });
    });

    fastify.get('/delivery-couriers/stats/daily', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.DELIVERY_COURIER_REPORT)]
    }, async (request, reply) => {
        return service.getDailyStats();
    });

    fastify.post('/delivery-couriers/:id/pay-commission', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.DELIVERY_COURIER_COMMISSION_PAY), auditAction('Courier.PayCommission')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        try {
            const userId = (request as any).user?.userId;
            return service.markCommissionsPaid({
                courierId: Number(id),
                fromDate: body.fromDate,
                toDate: body.toDate,
                orderIds: body.orderIds
            }, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });
}

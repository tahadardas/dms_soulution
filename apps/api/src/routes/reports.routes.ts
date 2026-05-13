import { FastifyInstance } from 'fastify';
import { ReportingService } from '../services/reportingService';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';

const reportPermissions = [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS];

export async function reportsRoutes(fastify: FastifyInstance) {
    const reportingService = new ReportingService(getDB());

    fastify.get('/reports/dashboard', {
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
    }, async (request) => {
        const { startDate, endDate } = request.query as { startDate: string; endDate: string };
        if (!startDate || !endDate) {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
            return reportingService.getDashboardStats(start, end);
        }
        return reportingService.getDashboardStats(startDate, endDate);
    });

    fastify.get('/reports/daily-sales', {
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
    }, async (request) => {
        const { startDate, endDate } = request.query as { startDate: string; endDate: string };
        return reportingService.getDailySales(startDate || '2020-01-01', endDate || new Date().toISOString());
    });

    fastify.get('/reports/sales', {
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
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
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
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
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
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
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
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
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
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
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
    }, async (request, reply) => {
        const { sessionId } = request.query as { sessionId?: string };
        if (!sessionId) {
            reply.status(400).send({ error: 'sessionId is required' });
            return;
        }
        return reportingService.getSessionOrders({ sessionId });
    });

    fastify.get('/reports/inventory', {
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
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
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
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

    fastify.get('/reports/inventory/valuation', {
        preHandler: [authenticate, requireAnyPermission(reportPermissions)]
    }, async (request, reply) => {
        const { asOfDate, branchId } = request.query as { asOfDate?: string; branchId?: string };
        try {
            return reportingService.getInventoryValuationReport({
                asOfDate: asOfDate || new Date().toISOString(),
                branchId: branchId ? Number(branchId) : undefined
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });
}

import { FastifyInstance } from 'fastify';
import { InsightService } from '../services/insightService';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';
import { getDB } from '../database';

export async function insightRoutes(fastify: FastifyInstance) {
    const db = getDB();
    const insightService = new InsightService(db);

    // List pending insights
    const insightPermissions = [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS];

    fastify.get('/insights/pending', {
        preHandler: [authenticate, requireAnyPermission(insightPermissions)]
    }, async (request, reply) => {
        return insightService.getPendingInsights();
    });

    // Apply (Approve) insight
    fastify.post('/insights/:id/apply', {
        preHandler: [authenticate, requireAnyPermission(insightPermissions)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = request.user!.userId;
        try {
            await insightService.applyInsight(id, userId);
            return { success: true };
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    // Dismiss (Reject) insight
    fastify.post('/insights/:id/dismiss', {
        preHandler: [authenticate, requireAnyPermission(insightPermissions)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = request.user!.userId;
        try {
            await insightService.dismissInsight(id, userId);
            return { success: true };
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });
}

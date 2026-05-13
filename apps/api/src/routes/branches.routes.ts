import { FastifyInstance } from 'fastify';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';

export async function branchesRoutes(fastify: FastifyInstance) {
    const db = getDB();

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
}

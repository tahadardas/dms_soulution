import { FastifyInstance } from 'fastify';
import z from 'zod';
import { AuditService } from '../services/audit';
import { AuthService } from '../services/auth';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { getDB } from '../database';
import { PERMISSIONS } from '../config/permissions';

const CreateUserSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    roleId: z.string(),
    branchId: z.number().optional()
});

export async function adminRoutes(fastify: FastifyInstance) {
    // GET Audit Logs
    fastify.get('/admin/audit-logs', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_VIEW_AUDIT)]
    }, async (request, reply) => {
        const { userId, branchId, limit, startDate, endDate } = request.query as any;
        const logs = AuditService.getLogs({
            userId: userId ? Number(userId) : undefined,
            branchId: branchId ? Number(branchId) : undefined,
            limit: limit ? Number(limit) : 50,
            startDate: startDate || undefined,
            endDate: endDate || undefined
        });
        return logs;
    });

    // CREATE User
    fastify.post('/admin/users', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_USERS), auditAction('User.Create')]
    }, async (request, reply) => {
        const body = CreateUserSchema.parse(request.body);

        try {
            const db = getDB();
            const hash = AuthService.hashPassword(body.password);

            const result = db.prepare(`
                INSERT INTO users (username, password_hash, role_id, branch_id)
                VALUES (@username, @hash, @roleId, @branchId)
            `).run({
                username: body.username,
                hash,
                roleId: body.roleId,
                branchId: body.branchId || null
            });

            // Log it
            AuditService.log({
                userId: request.user!.userId,
                action: 'USER.CREATE',
                branchId: request.user!.branchId,
                details: { newUserId: result.lastInsertRowid, role: body.roleId }
            });

            return { id: result.lastInsertRowid, username: body.username };
        } catch (err: any) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return reply.code(400).send({ message: 'Username already exists' });
            }
            throw err;
        }
    });

    // GET Users (for management)
    fastify.get('/admin/users', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_USERS)]
    }, async (request, reply) => {
        const db = getDB();
        // Return without sensitive data
        return db.prepare('SELECT id, username, role_id, branch_id, created_at FROM users').all();
    });
}

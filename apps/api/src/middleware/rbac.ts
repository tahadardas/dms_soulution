import { FastifyRequest, FastifyReply } from 'fastify';
import { getDB } from '../database';

export const requirePermission = (permissionCode: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user;
        if (!user) {
            return reply.code(401).send({ message: 'Unauthorized' });
        }

        if (user.role === 'admin') return;

        const db = getDB();

        const hasPermission = db.prepare(`
            SELECT 1 FROM role_permissions 
            WHERE role_id = ? AND permission_code = ?
        `).get(user.role, permissionCode);

        if (!hasPermission) {
            return reply.code(403).send({
                message: `Forbidden: Missing permission ${permissionCode}`
            });
        }
    };
};

export const requireAnyPermission = (permissionCodes: string[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user;
        if (!user) {
            return reply.code(401).send({ message: 'Unauthorized' });
        }

        if (user.role === 'admin') return;

        const db = getDB();
        const placeholders = permissionCodes.map(() => '?').join(',');
        const hasPermission = db.prepare(
            `SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_code IN (${placeholders})`
        ).get(user.role, ...permissionCodes);

        if (!hasPermission) {
            return reply.code(403).send({
                message: 'Forbidden: Missing required permission'
            });
        }
    };
};

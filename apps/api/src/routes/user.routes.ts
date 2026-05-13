import { FastifyInstance } from 'fastify';
import { UserService } from '../services/userService';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';

export default async function userRoutes(fastify: FastifyInstance) {
    const service = new UserService();

    fastify.get('/users', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_USERS)]
    }, async () => {
        return service.listUsers();
    });

    fastify.get('/users/roles', {
        preHandler: [authenticate]
    }, async () => {
        return service.listRoles();
    });

    fastify.post('/users', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_USERS)]
    }, async (request) => {
        return service.createUser(request.body as any);
    });

    fastify.put('/users/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_USERS)]
    }, async (request) => {
        const { id } = request.params as { id: string };
        return service.updateUser(Number(id), request.body as any);
    });

    fastify.delete('/users/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_USERS)]
    }, async (request) => {
        const { id } = request.params as { id: string };
        return service.deleteUser(Number(id));
    });
}

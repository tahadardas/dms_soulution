import { FastifyInstance } from 'fastify';
import { SettingsService } from '../services/settingsService';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { PERMISSIONS } from '../config/permissions';

export async function settingsRoutes(fastify: FastifyInstance) {
    const settingsService = new SettingsService(getDB());

    fastify.get('/settings/:category', {
        preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS, PERMISSIONS.POS_SALE])]
    }, async (request) => {
        const { category } = request.params as { category: string };
        return settingsService.getSettings(category);
    });

    fastify.get('/settings', {
        preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS, PERMISSIONS.POS_SALE])]
    }, async () => {
        return settingsService.getSettings('all');
    });

    fastify.put('/settings/:category', {
        preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS]), auditAction('Settings.Update')]
    }, async (request, reply) => {
        const { category } = request.params as { category: string };
        const user = request.user;
        try {
            settingsService.updateSettings(category, request.body, user!.userId);
            return { success: true };
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/settings/:category/history', {
        preHandler: [authenticate, requireAnyPermission([PERMISSIONS.SET_MANAGE_SETTINGS, PERMISSIONS.SET_MANAGE_PRINTERS])]
    }, async (request) => {
        const { category } = request.params as { category: string };
        return settingsService.getHistory(category);
    });
}

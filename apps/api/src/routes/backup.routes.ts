import { FastifyInstance } from 'fastify';
import { BackupService } from '../services/backupService';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { PERMISSIONS } from '../config/permissions';

export async function backupRoutes(fastify: FastifyInstance) {
    const db = (fastify as any).db; // Assume db is available on fastify or use getDB()
    const backupService = new BackupService(db);

    fastify.get('/admin/backups', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_SETTINGS)]
    }, async () => {
        return { items: backupService.listBackups() };
    });

    fastify.post('/admin/backups', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_SETTINGS), auditAction('Admin.BackupCreate')]
    }, async () => {
        const filename = await backupService.createBackup();
        return { filename };
    });

    fastify.post('/admin/backups/restore', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_SETTINGS), auditAction('Admin.BackupRestore')]
    }, async (request, reply) => {
        const { filename } = request.body as { filename: string };
        if (!filename) {
            reply.status(400).send({ error: 'Filename is required' });
            return;
        }
        await backupService.restoreBackup(filename);
        return { success: true, message: 'Database restored. Please restart the application.' };
    });

    fastify.delete('/admin/backups/:filename', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_SETTINGS), auditAction('Admin.BackupDelete')]
    }, async (request) => {
        const { filename } = request.params as { filename: string };
        backupService.deleteBackup(filename);
        return { success: true };
    });

    fastify.get('/admin/backups/config', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_SETTINGS)]
    }, async () => {
        return backupService.getBackupConfig();
    });

    fastify.put('/admin/backups/config', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_SETTINGS), auditAction('Admin.BackupConfigUpdate')]
    }, async (request) => {
        const { backupPath } = request.body as { backupPath: string };
        backupService.updateBackupConfig(backupPath);
        return { success: true };
    });
}

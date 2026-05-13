import { FastifyInstance } from 'fastify';
import { PrintingService } from '../services/printingService';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission, requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { PERMISSIONS } from '../config/permissions';

export async function printingRoutes(fastify: FastifyInstance) {
    const db = getDB();
    const printingService = new PrintingService(db);
    const managePrinting = [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_PRINTERS)];
    const useLocalAgent = [
        authenticate,
        requireAnyPermission([
            PERMISSIONS.POS_ORDER_PRINT,
            PERMISSIONS.SET_MANAGE_PRINTERS,
            PERMISSIONS.PRINTING_MANAGE
        ])
    ];

    fastify.get('/printers', {
        preHandler: managePrinting
    }, async () => {
        return { items: printingService.listPrinters() };
    });

    fastify.post('/printers', {
        preHandler: managePrinting
    }, async (request, reply) => {
        try {
            return printingService.createPrinter(request.body as any);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.put('/printers/:id', {
        preHandler: managePrinting
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return printingService.updatePrinter(Number(id), request.body as any);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/printers/:id', {
        preHandler: managePrinting
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return printingService.deletePrinter(Number(id));
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.post('/printers/:id/test', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.PRINTER_TEST), auditAction('Printing.TestPrinter')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as { processNow?: boolean } | undefined;
        try {
            return await printingService.testPrinter(Number(id), body?.processNow !== false);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/routes', {
        preHandler: managePrinting
    }, async () => {
        return { items: printingService.listRoutes() };
    });

    fastify.post('/routes', {
        preHandler: managePrinting
    }, async (request, reply) => {
        try {
            return printingService.createRoute(request.body as any);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.put('/routes/:id', {
        preHandler: managePrinting
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return printingService.updateRoute(Number(id), request.body as any);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/routes/:id', {
        preHandler: managePrinting
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return printingService.deleteRoute(Number(id));
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/templates', {
        preHandler: managePrinting
    }, async () => {
        return { items: printingService.listTemplates() };
    });

    fastify.post('/templates', {
        preHandler: managePrinting
    }, async (request, reply) => {
        try {
            return printingService.createTemplate(request.body as any);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.put('/templates/:id', {
        preHandler: managePrinting
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return printingService.updateTemplate(Number(id), request.body as any);
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/templates/:id', {
        preHandler: managePrinting
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return printingService.deleteTemplate(Number(id));
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/jobs', {
        preHandler: managePrinting
    }, async (request) => {
        const { status, type, limit } = request.query as any;
        return { items: printingService.listJobs({ status, type, limit: limit ? Number(limit) : undefined }) };
    });

    fastify.get('/jobs/pending-local', {
        preHandler: useLocalAgent
    }, async (request, reply) => {
        const { deviceKey, limit } = request.query as { deviceKey?: string; limit?: string };
        try {
            return { items: printingService.listPendingLocalJobs(deviceKey || '', limit ? Number(limit) : 20) };
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/jobs/:id', {
        preHandler: managePrinting
    }, async (request) => {
        const { id } = request.params as { id: string };
        return printingService.getJobStatus(id);
    });

    fastify.post('/jobs/:id/retry', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_PRINTERS), auditAction('Printing.RetryJob')]
    }, async (request) => {
        const { id } = request.params as { id: string };
        return printingService.retryJob(id);
    });

    fastify.post('/jobs/:id/lock', {
        preHandler: useLocalAgent
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { deviceKey } = (request.body ?? {}) as { deviceKey?: string };
        try {
            return printingService.lockLocalJob({ jobId: id, deviceKey: deviceKey || '' });
        } catch (error: any) {
            reply.status(409).send({ error: error.message });
        }
    });

    fastify.post('/jobs/:id/complete', {
        preHandler: useLocalAgent
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { deviceKey } = (request.body ?? {}) as { deviceKey?: string };
        try {
            return printingService.completeLocalJob({ jobId: id, deviceKey: deviceKey || '' });
        } catch (error: any) {
            reply.status(409).send({ error: error.message });
        }
    });

    fastify.post('/jobs/:id/fail', {
        preHandler: useLocalAgent
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const { deviceKey, errorMessage } = (request.body ?? {}) as { deviceKey?: string; errorMessage?: string };
        try {
            return printingService.failLocalJob({
                jobId: id,
                deviceKey: deviceKey || '',
                errorMessage: errorMessage || 'Local printer failed'
            });
        } catch (error: any) {
            reply.status(409).send({ error: error.message });
        }
    });

    fastify.post('/process-queue', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.SET_MANAGE_PRINTERS), auditAction('Printing.ProcessQueue')]
    }, async (request) => {
        const { limit } = request.query as any;
        return printingService.processQueue(limit ? Number(limit) : 20);
    });

    fastify.post('/workstations/register', {
        preHandler: useLocalAgent
    }, async (request, reply) => {
        const body = request.body as { deviceKey?: string; name?: string; branchId?: number | null };
        try {
            return printingService.registerWorkstation({
                deviceKey: body.deviceKey || '',
                name: body.name || '',
                branchId: body.branchId ?? null
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.post('/workstations/:deviceKey/heartbeat', {
        preHandler: useLocalAgent
    }, async (request, reply) => {
        const { deviceKey } = request.params as { deviceKey: string };
        try {
            return printingService.heartbeatWorkstation(deviceKey);
        } catch (error: any) {
            reply.status(404).send({ error: error.message });
        }
    });
}

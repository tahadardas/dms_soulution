import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getDB } from './database';
import { PrintingService } from './services/printingService';
import { authRoutes } from './routes/auth';
import { adminRoutes } from './routes/admin';
import { posRoutes } from './routes/pos.routes';
import { insightRoutes } from './routes/insights';
import userRoutes from './routes/user.routes';
import { backupRoutes } from './routes/backup.routes';
import { invoiceRoutes } from './routes/invoice.routes';
import { deliveryCourierRoutes } from './routes/deliveryCourier.routes';
import { printingRoutes } from './routes/printing.routes';
import { accountingRoutes } from './routes/accounting.routes';
import { inventoryRoutes } from './routes/inventory.routes';
import { reportsRoutes } from './routes/reports.routes';
import { branchesRoutes } from './routes/branches.routes';
import { userSettingsRoutes } from './routes/userSettings.routes';
import { settingsRoutes } from './routes/settings.routes';
import { documentRoutes } from './routes/documents.routes';
import { getCorsOrigins } from './config/security';

const fastify = Fastify({
    logger: true
});

const db = getDB();
(fastify as any).db = db;

fastify.register(cors, {
    origin: getCorsOrigins()
});

fastify.register(authRoutes);
fastify.register(adminRoutes);
fastify.register(posRoutes);
fastify.register(insightRoutes);
fastify.register(userRoutes);
fastify.register(userSettingsRoutes);
fastify.register(backupRoutes);
fastify.register(invoiceRoutes);
fastify.register(deliveryCourierRoutes);
fastify.register(accountingRoutes);
fastify.register(inventoryRoutes);
fastify.register(reportsRoutes);
fastify.register(branchesRoutes);
fastify.register(settingsRoutes);
fastify.register(documentRoutes);
fastify.register(printingRoutes, { prefix: '/printing' });

fastify.get('/', async () => {
    return { hello: 'world' };
});

fastify.get('/health', async () => {
    return {
        status: 'ok',
        timestamp: new Date().toISOString()
    };
});

const printingService = new PrintingService(db);
setInterval(() => {
    printingService.processQueue(10).catch((err) => {
        fastify.log.error({ err }, 'Background printing error');
    });
}, 5000);

const start = async () => {
    try {
        const port = Number(process.env.DMS_PORT || 3000);
        const host = process.env.DMS_HOST || '0.0.0.0';
        await fastify.listen({ port, host });
        fastify.log.info(`API listening on http://${host}:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();

import { FastifyInstance } from 'fastify';
import { InvoiceService } from '../services/invoiceService';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { PERMISSIONS } from '../config/permissions';

export async function invoiceRoutes(fastify: FastifyInstance) {
    const db = getDB();
    const service = new InvoiceService(db);

    // --- Suppliers ---

    fastify.get('/suppliers', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE)]
    }, async () => {
        return { items: service.listSuppliers() };
    });

    fastify.get('/customers', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV)]
    }, async () => {
        return { items: service.listCustomers() };
    });

    fastify.post('/customers', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('Customer.Create')]
    }, async (request, reply) => {
        try {
            return service.createCustomer(request.body as any);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.put('/customers/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('Customer.Update')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return service.updateCustomer(Number(id), request.body as any);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/customers/:id/receipts', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('CustomerReceipt.Record')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.userId;
        try {
            return service.recordCustomerReceipt({
                ...(request.body as any),
                customer_id: Number(id)
            }, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/customers/:id/statement', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const query = request.query as any;
        try {
            return service.getCustomerStatement(Number(id), {
                startDate: query.startDate,
                endDate: query.endDate
            });
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/suppliers', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE), auditAction('Supplier.Create')]
    }, async (request, reply) => {
        try {
            return service.createSupplier(request.body as any);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.put('/suppliers/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE), auditAction('Supplier.Update')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return service.updateSupplier(Number(id), request.body as any);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/suppliers/:id/payments', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE), auditAction('SupplierPayment.Record')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.userId;
        try {
            return service.recordSupplierPayment({
                ...(request.body as any),
                supplier_id: Number(id)
            }, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.get('/suppliers/:id/statement', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const query = request.query as any;
        try {
            return service.getSupplierStatement(Number(id), {
                startDate: query.startDate,
                endDate: query.endDate
            });
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    // --- Purchase Invoices ---

    fastify.get('/purchase-invoices', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE)]
    }, async (request) => {
        const query = request.query as any;
        return { items: service.listPurchaseInvoices(query) };
    });

    fastify.get('/purchase-invoices/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const invoice = service.getPurchaseInvoice(id);
        if (!invoice) return reply.status(404).send({ error: 'Invoice not found' });
        return invoice;
    });

    fastify.post('/purchase-invoices', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE), auditAction('PurchaseInvoice.Create')]
    }, async (request, reply) => {
        const userId = (request as any).user?.userId;
        try {
            return service.createPurchaseInvoice(request.body as any, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.put('/purchase-invoices/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE), auditAction('PurchaseInvoice.Update')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return service.updatePurchaseInvoice(id, request.body as any);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/purchase-invoices/:id/post', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE), auditAction('PurchaseInvoice.Post')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.userId;
        try {
            return service.postPurchaseInvoice(id, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/purchase-invoices/:id/return', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_PURCHASE), auditAction('PurchaseInvoice.Return')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.userId;
        const body = request.body as { reason?: string } | undefined;
        try {
            return service.reversePostedPurchaseInvoice(id, userId, body?.reason);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    // --- Sales Invoices ---

    fastify.get('/sales-invoices', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV)]
    }, async (request) => {
        const query = request.query as any;
        return { items: service.listSalesInvoices(query) };
    });

    fastify.get('/sales-invoices/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const invoice = service.getSalesInvoice(id);
        if (!invoice) return reply.status(404).send({ error: 'Invoice not found' });
        return invoice;
    });

    fastify.post('/sales-invoices', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('SalesInvoice.Create')]
    }, async (request, reply) => {
        const userId = (request as any).user?.userId;
        try {
            return service.createSalesInvoice(request.body as any, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.put('/sales-invoices/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('SalesInvoice.Update')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return service.updateSalesInvoice(id, request.body as any);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/sales-invoices/:id/post', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('SalesInvoice.Post')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.userId;
        try {
            return service.postSalesInvoice(id, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/sales-invoices/:id/payments', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('SalesInvoice.Payment')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.userId;
        try {
            return service.recordSalesInvoicePayment(id, request.body as any, userId);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });

    fastify.post('/sales-invoices/:id/return', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.INV_SALES_INV), auditAction('SalesInvoice.Return')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const userId = (request as any).user?.userId;
        const body = request.body as { reason?: string } | undefined;
        try {
            return service.reversePostedSalesInvoice(id, userId, body?.reason);
        } catch (err: any) {
            reply.status(400).send({ error: err.message });
        }
    });
}

import { FastifyInstance } from 'fastify';
import { AccountingService } from '../services/accountingService';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { auditAction } from '../middleware/audit';
import { PERMISSIONS } from '../config/permissions';

export async function accountingRoutes(fastify: FastifyInstance) {
    const db = getDB();
    const accountingService = new AccountingService(db);

    fastify.post('/accounting/accounts', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_EDIT_COA)]
    }, async (request, reply) => {
        try {
            const body = request.body as any;
            return accountingService.createAccount({
                code: body.code,
                name: body.name,
                type: body.type,
                parent_id: body.parent_id ?? null,
                is_active: body.is_active ?? 1,
                branch_id: body.branch_id ?? null
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/accounting/accounts', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_COA)]
    }, async (request) => {
        const query = request.query as any;
        const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
        return { items: accountingService.listAccounts(query.search, Number.isNaN(branchId) ? undefined : branchId) };
    });

    fastify.put('/accounting/accounts/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_EDIT_COA)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        try {
            return accountingService.updateAccount(Number(id), {
                code: body.code,
                name: body.name,
                type: body.type,
                parent_id: body.parent_id ?? null,
                is_active: body.is_active ?? 1
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.delete('/accounting/accounts/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_EDIT_COA)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        try {
            return accountingService.deleteAccount(Number(id));
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.post('/accounting/entries', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_CREATE_JOURNAL), auditAction('Accounting.CreateEntry')]
    }, async (request, reply) => {
        try {
            const body = request.body as any;
            const user = request.user;
            if (!body.lines || body.lines.length < 2) {
                reply.status(400).send({ error: 'At least two lines are required.' });
                return;
            }
            const entry = accountingService.createJournalEntry({
                date: body.date,
                description: body.description,
                source_type: body.source_type || 'MANUAL',
                source_id: body.source_id,
                branch_id: user?.branchId ?? null,
                lines: body.lines
            }, {
                allowUnbalanced: Boolean(body.allowUnbalanced),
                unbalancedReason: body.unbalancedReason ?? body.unbalanced_reason
            });
            return entry;
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.post('/accounting/entries/:id/post', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_POST_JOURNAL), auditAction('Accounting.PostEntry')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        try {
            accountingService.postEntry(id, user?.userId);
            return { success: true };
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/accounting/reports/trial-balance', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
    }, async (request) => {
        const query = request.query as any;
        const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
        return accountingService.getTrialBalance({
            startDate: query.startDate,
            endDate: query.endDate,
            branchId: Number.isNaN(branchId) ? undefined : branchId
        });
    });

    fastify.get('/accounting/reports/ledger', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
    }, async (request, reply) => {
        const query = request.query as any;
        const accountId = Number(query.accountId);
        if (!accountId || Number.isNaN(accountId)) {
            reply.status(400).send({ error: 'accountId is required.' });
            return;
        }
        const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
        try {
            return accountingService.getLedgerReport({
                accountId,
                startDate: query.startDate,
                endDate: query.endDate,
                branchId: Number.isNaN(branchId) ? undefined : branchId,
                sourceType: query.sourceType,
                partyType: query.partyType,
                partyId: query.partyId ? Number(query.partyId) : undefined
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.get('/accounting/entries', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
    }, async (request) => {
        const query = request.query as any;
        const branchId = query.branchId !== undefined ? Number(query.branchId) : undefined;
        return {
            items: accountingService.listJournalEntries({
                status: query.status === 'draft' || query.status === 'posted' ? query.status : undefined,
                startDate: query.startDate,
                endDate: query.endDate,
                search: query.search,
                branchId: Number.isNaN(branchId) ? undefined : branchId
            })
        };
    });

    fastify.get('/accounting/entries/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_VIEW_REPORTS)]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const entry = accountingService.getJournalEntry(id);
        if (!entry) {
            reply.status(404).send({ error: 'Entry not found' });
            return;
        }
        return entry;
    });

    fastify.put('/accounting/entries/:id', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_CREATE_JOURNAL), auditAction('Accounting.UpdateEntry')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        try {
            if (!body.lines || body.lines.length < 2) {
                reply.status(400).send({ error: 'At least two lines are required.' });
                return;
            }
            return accountingService.updateJournalEntry(id, {
                date: body.date,
                description: body.description,
                lines: body.lines,
                unbalancedReason: body.unbalancedReason ?? body.unbalanced_reason
            });
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });

    fastify.post('/accounting/entries/:id/reverse', {
        preHandler: [authenticate, requirePermission(PERMISSIONS.ACC_REVERSE_JOURNAL), auditAction('Accounting.ReverseEntry')]
    }, async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = request.user;
        try {
            const reversal = accountingService.reverseEntry(id, user?.userId);
            return { id: reversal.id };
        } catch (error: any) {
            reply.status(400).send({ error: error.message });
        }
    });
}

import { FastifyInstance } from 'fastify';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';
import { requireAnyPermission } from '../middleware/rbac';
import { PERMISSIONS } from '../config/permissions';
import { DocumentService, DocumentTypeCode } from '../services/documentService';

const documentViewPermissions = [
    PERMISSIONS.ACC_VIEW_REPORTS,
    PERMISSIONS.RPT_VIEW,
    PERMISSIONS.INV_VIEW
];

export async function documentRoutes(fastify: FastifyInstance) {
    const service = new DocumentService(getDB());

    fastify.get('/documents/types', {
        preHandler: [authenticate, requireAnyPermission(documentViewPermissions)]
    }, async () => {
        return { items: service.listDocumentTypes() };
    });

    fastify.get('/documents/sequences/next', {
        preHandler: [authenticate, requireAnyPermission([PERMISSIONS.ACC_CREATE_JOURNAL, PERMISSIONS.INV_ADJUST])]
    }, async (request, reply) => {
        const query = request.query as { documentType?: DocumentTypeCode; branchId?: string };
        if (!query.documentType) {
            reply.status(400).send({ error: 'documentType is required' });
            return;
        }
        const branchId = query.branchId ? Number(query.branchId) : null;
        return { document_number: service.nextDocumentNumber(query.documentType, branchId) };
    });

    fastify.get('/documents/:documentType/:sourceId', {
        preHandler: [authenticate, requireAnyPermission(documentViewPermissions)]
    }, async (request, reply) => {
        const { documentType, sourceId } = request.params as { documentType: DocumentTypeCode; sourceId: string };
        const document = service.getDocument(documentType, sourceId);
        if (!document) {
            reply.status(404).send({ error: 'Document not found' });
            return;
        }
        return document;
    });
}

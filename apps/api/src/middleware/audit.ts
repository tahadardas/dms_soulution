import { FastifyRequest, FastifyReply } from 'fastify';
import { AuditService } from '../services/audit';

export const auditAction = (action: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        const user = request.user;
        if (user) {
            AuditService.log({
                userId: user.userId,
                action: action,
                branchId: user.branchId,
                details: {
                    method: request.method,
                    url: request.url,
                    params: request.params,
                    // Body might be sensitive, so be careful. 
                    // For now we don't log full body here to avoid PII/Password leaks in general middleware.
                    // Detailed body logging should be done in routes.
                }
            });
        }
    };
};

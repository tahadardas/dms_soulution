import { TokenPayload } from '../services/auth';

declare module 'fastify' {
    interface FastifyRequest {
        user?: TokenPayload;
    }
}

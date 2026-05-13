import { FastifyInstance } from 'fastify';
import z from 'zod';
import { AuthService } from '../services/auth';
import { AuditService } from '../services/audit';

const LoginSchema = z.object({
    username: z.string(),
    password: z.string()
});

const RefreshSchema = z.object({
    refreshToken: z.string()
});

const LOGIN_WINDOW_MS = 60_000;
const MAX_LOGIN_ATTEMPTS = 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function assertLoginAllowed(key: string): void {
    const now = Date.now();
    const current = loginAttempts.get(key);
    if (!current || current.resetAt <= now) {
        loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
        return;
    }
    if (current.count >= MAX_LOGIN_ATTEMPTS) {
        throw new Error('Too many login attempts. Please wait before trying again.');
    }
    current.count += 1;
}

function clearLoginAttempts(key: string): void {
    loginAttempts.delete(key);
}

export async function authRoutes(fastify: FastifyInstance) {
    fastify.post('/auth/login', async (request, reply) => {
        const body = LoginSchema.parse(request.body);
        const attemptKey = `${request.ip}:${body.username.toLowerCase()}`;

        try {
            assertLoginAllowed(attemptKey);
            const result = await AuthService.login(body.username, body.password);
            clearLoginAttempts(attemptKey);

            // Log successful login
            // We can't really log device safely without more headers, but let's try User-Agent
            const deviceId = (request.headers['user-agent'] as string) || 'unknown';

            AuditService.log({
                userId: result.user.id,
                action: 'AUTH.LOGIN',
                branchId: result.user.branch_id, // Note: user.branch_id needed in token payload or fetched
                deviceId,
                details: { ip: request.ip }
            });

            return result;
        } catch (err: any) {
            if (String(err?.message || '').includes('Too many login attempts')) {
                return reply.code(429).send({ message: err.message });
            }
            return reply.code(401).send({ message: 'Invalid credentials' });
        }
    });

    fastify.post('/auth/refresh', async (request, reply) => {
        const body = RefreshSchema.parse(request.body);
        try {
            const result = await AuthService.refreshToken(body.refreshToken);
            return result;
        } catch (err) {
            return reply.code(401).send({ message: 'Invalid refresh token' });
        }
    });
}

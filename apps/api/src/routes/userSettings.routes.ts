import { FastifyInstance } from 'fastify';
import z from 'zod';
import { getDB } from '../database';
import { authenticate } from '../middleware/auth';

const UserSettingsSchema = z.object({
    language: z.enum(['en', 'ar']).optional()
});

const parseUserSettings = (value?: string | null) => {
    if (!value) return {};
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
};

export async function userSettingsRoutes(fastify: FastifyInstance) {
    const db = getDB();

    fastify.get('/users/me/settings', {
        preHandler: [authenticate]
    }, async (request, reply) => {
        const userId = request.user?.userId;
        if (!userId) {
            reply.status(401).send({ error: 'Unauthorized' });
            return;
        }
        const row = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as { settings?: string | null } | undefined;
        return parseUserSettings(row?.settings);
    });

    fastify.put('/users/me/settings', {
        preHandler: [authenticate]
    }, async (request, reply) => {
        const userId = request.user?.userId;
        if (!userId) {
            reply.status(401).send({ error: 'Unauthorized' });
            return;
        }
        const body = UserSettingsSchema.parse(request.body || {});
        const row = db.prepare('SELECT settings FROM users WHERE id = ?').get(userId) as { settings?: string | null } | undefined;
        const current = parseUserSettings(row?.settings);
        const nextSettings = { ...current, ...body };
        db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(nextSettings), userId);
        return nextSettings;
    });
}

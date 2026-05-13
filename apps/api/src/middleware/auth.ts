import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { TokenPayload } from '../services/auth';
import { getJwtSecret } from '../config/security';

const SECRET_KEY = getJwtSecret();

export const authenticate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
        const authHeader = request.headers.authorization;
        if (!authHeader) {
            return reply.code(401).send({ message: 'No token provided' });
        }

        const token = authHeader.split(' ')[1]; // Bearer <token>
        if (!token) {
            return reply.code(401).send({ message: 'Invalid token format' });
        }

        const decoded = jwt.verify(token, SECRET_KEY) as TokenPayload;
        if (decoded.mustChangePassword && !request.url.startsWith('/auth/change-password')) {
            return reply.code(403).send({ message: 'Password change required', mustChangePassword: true });
        }
        request.user = decoded;
    } catch (err) {
        return reply.code(401).send({ message: 'Invalid or expired token' });
    }
};

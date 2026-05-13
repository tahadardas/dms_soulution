import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDB } from '../database';
import { getJwtSecret, getRefreshSecret } from '../config/security';

const SECRET_KEY = getJwtSecret();
const REFRESH_SECRET_KEY = getRefreshSecret();

// Types
export interface User {
    id: number;
    username: string;
    role_id: string;
    branch_id?: number;
    settings?: string | null;
}

export interface TokenPayload {
    userId: number;
    username: string;
    role: string;
    branchId?: number;
}

export class AuthService {
    static parseSettings(value?: string | null) {
        if (!value) return {};
        try {
            return JSON.parse(value);
        } catch {
            return {};
        }
    }

    static async login(username: string, password: string) {
        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User & { password_hash: string };

        if (!user) {
            throw new Error('Invalid credentials');
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }

        return this.generateTokens(user);
    }

    static async refreshToken(token: string) {
        try {
            const payload = jwt.verify(token, REFRESH_SECRET_KEY) as TokenPayload;
            const db = getDB();
            const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as User;

            if (!user) {
                throw new Error('User not found');
            }

            return this.generateTokens(user);
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    static getPermissionsForRole(roleId: string): string[] {
        const db = getDB();
        const rows = db.prepare('SELECT permission_code FROM role_permissions WHERE role_id = ?').all(roleId) as { permission_code: string }[];
        return rows.map(row => row.permission_code);
    }

    static generateTokens(user: User) {
        const payload: TokenPayload = {
            userId: user.id,
            username: user.username,
            role: user.role_id,
            branchId: user.branch_id
        };

        const accessToken = jwt.sign(payload, SECRET_KEY, { expiresIn: '15m' });
        const refreshToken = jwt.sign(payload, REFRESH_SECRET_KEY, { expiresIn: '7d' });

        const permissions = this.getPermissionsForRole(user.role_id);

        return {
            user: {
                id: user.id,
                username: user.username,
                role: user.role_id,
                branch_id: user.branch_id,
                settings: this.parseSettings(user.settings)
            },
            accessToken,
            refreshToken,
            permissions
        };
    }

    static hashPassword(password: string) {
        return bcrypt.hashSync(password, 10);
    }
}

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
    is_active?: number;
    must_change_password?: number;
    failed_login_count?: number;
    locked_until?: string | null;
}

export interface TokenPayload {
    userId: number;
    username: string;
    role: string;
    branchId?: number;
    mustChangePassword?: boolean;
}

export class AuthService {
    private static readonly MAX_FAILED_ATTEMPTS = 5;
    private static readonly LOCKOUT_MS = 15 * 60 * 1000;

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
        if (user.is_active !== undefined && Number(user.is_active) === 0) {
            throw new Error('Invalid credentials');
        }
        if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
            throw new Error('Account is temporarily locked. Please try again later.');
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
            this.recordFailedLogin(user.id);
            throw new Error('Invalid credentials');
        }

        this.resetFailedLogin(user.id);
        return this.generateTokens(user);
    }

    static async changePassword(userId: number, currentPassword: string, newPassword: string) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error('New password must be at least 8 characters.');
        }
        if (newPassword === 'admin123') {
            throw new Error('The default admin password cannot be reused.');
        }
        const db = getDB();
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as (User & { password_hash: string }) | undefined;
        if (!user) {
            throw new Error('User not found');
        }
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) {
            throw new Error('Invalid credentials');
        }
        db.prepare(`
            UPDATE users
            SET password_hash = ?,
                must_change_password = 0,
                failed_login_count = 0,
                locked_until = NULL,
                password_changed_at = datetime('now')
            WHERE id = ?
        `).run(this.hashPassword(newPassword), userId);
        const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User;
        return this.generateTokens(updated);
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
            branchId: user.branch_id,
            mustChangePassword: Number(user.must_change_password || 0) === 1
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
                settings: this.parseSettings(user.settings),
                mustChangePassword: Number(user.must_change_password || 0) === 1
            },
            accessToken,
            refreshToken,
            permissions
        };
    }

    static hashPassword(password: string) {
        return bcrypt.hashSync(password, 10);
    }

    private static recordFailedLogin(userId: number): void {
        const db = getDB();
        const row = db.prepare('SELECT failed_login_count FROM users WHERE id = ?').get(userId) as { failed_login_count: number } | undefined;
        const nextCount = Number(row?.failed_login_count || 0) + 1;
        const lockedUntil = nextCount >= this.MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + this.LOCKOUT_MS).toISOString()
            : null;
        db.prepare(`
            UPDATE users
            SET failed_login_count = ?,
                locked_until = ?,
                last_failed_login_at = datetime('now')
            WHERE id = ?
        `).run(nextCount, lockedUntil, userId);
    }

    private static resetFailedLogin(userId: number): void {
        const db = getDB();
        db.prepare(`
            UPDATE users
            SET failed_login_count = 0,
                locked_until = NULL,
                last_failed_login_at = NULL
            WHERE id = ?
        `).run(userId);
    }
}

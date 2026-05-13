import { Database } from 'better-sqlite3';
import { getDB } from '../database';
import bcrypt from 'bcryptjs';

export interface UserDTO {
    id?: number;
    username: string;
    password?: string;
    role_id: string;
    branch_id?: number | null;
    settings?: any;
}

export class UserService {
    private db: Database;

    constructor() {
        this.db = getDB();
    }

    listUsers() {
        return this.db.prepare(`
            SELECT id, username, role_id, branch_id, created_at, settings 
            FROM users 
            ORDER BY created_at DESC
        `).all() as any[];
    }

    getUser(id: number) {
        return this.db.prepare('SELECT id, username, role_id, branch_id, created_at, settings FROM users WHERE id = ?').get(id) as any;
    }

    createUser(data: UserDTO) {
        if (!data.password) throw new Error('Password is required for new users');
        const passwordHash = bcrypt.hashSync(data.password, 10);
        
        const result = this.db.prepare(`
            INSERT INTO users (username, password_hash, role_id, branch_id, settings)
            VALUES (?, ?, ?, ?, ?)
        `).run(data.username, passwordHash, data.role_id, data.branch_id || null, JSON.stringify(data.settings || {}));

        return { id: result.lastInsertRowid };
    }

    updateUser(id: number, data: Partial<UserDTO>) {
        const existing = this.getUser(id);
        if (!existing) throw new Error('User not found');

        let query = 'UPDATE users SET username = ?, role_id = ?, branch_id = ?, settings = ?';
        const params = [
            data.username || existing.username,
            data.role_id || existing.role_id,
            data.branch_id !== undefined ? data.branch_id : existing.branch_id,
            data.settings ? JSON.stringify(data.settings) : existing.settings
        ];

        if (data.password) {
            query += ', password_hash = ?';
            params.push(bcrypt.hashSync(data.password, 10));
        }

        query += ' WHERE id = ?';
        params.push(id);

        this.db.prepare(query).run(...params);
        return { success: true };
    }

    deleteUser(id: number) {
        // Prevent deleting the last admin if possible, but for now simple delete
        this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return { success: true };
    }

    listRoles() {
        return this.db.prepare('SELECT id, name, description FROM roles').all() as any[];
    }
}

import { getDB } from '../database';

export interface AuditEntry {
    userId: number;
    action: string;
    branchId?: number;
    deviceId?: string;
    details?: object;
}

export class AuditService {
    static log(entry: AuditEntry) {
        const db = getDB();
        try {
            db.prepare(`
                INSERT INTO audit_logs (user_id, action, branch_id, device_id, details)
                VALUES (@userId, @action, @branchId, @deviceId, @details)
            `).run({
                userId: entry.userId,
                action: entry.action,
                branchId: entry.branchId || null,
                deviceId: entry.deviceId || 'unknown',
                details: JSON.stringify(entry.details || {})
            });
        } catch (err) {
            console.error('Failed to log audit event', err);
            // Don't throw, we don't want to break the app flow for logging failure?
            // Actually for strict Audit, we MIGHT want to throw. But for now logging to console is safe fallback.
        }
    }

    static getLogs(filters: { userId?: number; branchId?: number; limit?: number; startDate?: string; endDate?: string }) {
        const db = getDB();
        let query = `
            SELECT al.*, u.username, b.name as branch_name
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN branches b ON al.branch_id = b.id
            WHERE 1=1
        `;
        const params: any[] = [];

        if (filters.userId) {
            query += ' AND al.user_id = ?';
            params.push(filters.userId);
        }
        if (filters.branchId) {
            query += ' AND al.branch_id = ?';
            params.push(filters.branchId);
        }
        if (filters.startDate) {
            query += ' AND al.created_at >= ?';
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            query += ' AND al.created_at <= ?';
            params.push(filters.endDate);
        }

        query += ' ORDER BY al.created_at DESC LIMIT ?';
        params.push(filters.limit || 100);

        return db.prepare(query).all(...params);
    }
}

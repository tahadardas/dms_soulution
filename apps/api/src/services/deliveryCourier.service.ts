import { Database } from 'better-sqlite3';

export interface CourierInput {
    name: string;
    phone?: string | null;
    notes?: string | null;
    commissionEnabled: boolean;
    commissionType: 'NONE' | 'FIXED_PER_ORDER' | 'PERCENT_OF_ORDER' | 'MANUAL';
    commissionValue: number;
    isActive?: boolean;
}

export interface CourierStatsFilters {
    startDate?: string;
    endDate?: string;
    courierId?: number;
    branchId?: number;
}

export class DeliveryCourierService {
    constructor(private db: Database) {}

    searchCouriers(query: string, limit = 10) {
        const sql = `
            SELECT * FROM delivery_couriers
            WHERE (name LIKE ? OR phone LIKE ?) AND is_active = 1
            LIMIT ?
        `;
        const pattern = `%${query}%`;
        const items = this.db.prepare(sql).all(pattern, pattern, limit) as any[];
        return items.map(item => ({
            ...item,
            commissionEnabled: !!item.commission_enabled,
            commissionType: item.commission_type,
            commissionValue: item.commission_value,
            isActive: !!item.is_active
        }));
    }

    createCourier(input: CourierInput, userId?: number) {
        if (!input.name || !input.name.trim()) {
            throw new Error('اسم المندوب مطلوب.');
        }

        const phone = input.phone?.trim() || null;
        if (phone) {
            const existing = this.db.prepare(
                'SELECT id FROM delivery_couriers WHERE name = ? AND phone = ?'
            ).get(input.name.trim(), phone);
            if (existing) {
                throw new Error('يوجد مندوب بنفس الاسم ورقم الهاتف بالفعل.');
            }
        }

        const info = this.db.prepare(`
            INSERT INTO delivery_couriers (
                name, phone, notes, is_active, 
                commission_enabled, commission_type, commission_value,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(
            input.name.trim(),
            phone,
            input.notes || null,
            input.isActive !== false ? 1 : 0,
            input.commissionEnabled ? 1 : 0,
            input.commissionType || 'NONE',
            input.commissionValue || 0
        );

        return this.getCourierById(Number(info.lastInsertRowid));
    }

    updateCourier(id: number, input: Partial<CourierInput>, userId?: number) {
        const current = this.getCourierById(id);
        if (!current) throw new Error('المندوب غير موجود.');

        const name = input.name !== undefined ? input.name.trim() : current.name;
        const phone = input.phone !== undefined ? (input.phone?.trim() || null) : current.phone;
        const notes = input.notes !== undefined ? (input.notes || null) : current.notes;
        const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : current.is_active;
        const commissionEnabled = input.commissionEnabled !== undefined ? (input.commissionEnabled ? 1 : 0) : current.commission_enabled;
        const commissionType = input.commissionType !== undefined ? input.commissionType : current.commission_type;
        const commissionValue = input.commissionValue !== undefined ? input.commissionValue : current.commission_value;

        this.db.prepare(`
            UPDATE delivery_couriers
            SET name = ?, phone = ?, notes = ?, is_active = ?,
                commission_enabled = ?, commission_type = ?, commission_value = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(name, phone, notes, isActive, commissionEnabled, commissionType, commissionValue, id);

        return this.getCourierById(id);
    }

    getCourierById(id: number) {
        const item = this.db.prepare('SELECT * FROM delivery_couriers WHERE id = ?').get(id) as any;
        if (!item) return null;
        return {
            ...item,
            commissionEnabled: !!item.commission_enabled,
            commissionType: item.commission_type,
            commissionValue: item.commission_value,
            isActive: !!item.is_active
        };
    }

    calculateCommission(input: {
        courierId?: number;
        orderTotal: number;
        commissionType?: string;
        commissionValue?: number;
        manualCommissionAmount?: number;
    }) {
        let type = input.commissionType || 'NONE';
        let value = input.commissionValue || 0;

        if (input.courierId && !input.commissionType) {
            const courier = this.getCourierById(input.courierId);
            if (courier && courier.commissionEnabled) {
                type = courier.commissionType;
                value = courier.commissionValue;
            } else {
                type = 'NONE';
                value = 0;
            }
        }

        switch (type) {
            case 'FIXED_PER_ORDER':
                return value;
            case 'PERCENT_OF_ORDER':
                return (input.orderTotal * value) / 100;
            case 'MANUAL':
                return input.manualCommissionAmount || 0;
            case 'NONE':
            default:
                return 0;
        }
    }

    getCourierStats(filters: CourierStatsFilters) {
        let whereClauses = ["o.order_type = 'DELIVERY' AND o.status != 'VOID'"];
        const params: any[] = [];

        if (filters.courierId) {
            whereClauses.push("o.delivery_courier_id = ?");
            params.push(filters.courierId);
        }
        if (filters.branchId) {
            whereClauses.push("o.branch_id = ?");
            params.push(filters.branchId);
        }
        if (filters.startDate) {
            whereClauses.push("o.created_at >= ?");
            params.push(filters.startDate);
        }
        if (filters.endDate) {
            whereClauses.push("o.created_at <= ?");
            params.push(filters.endDate);
        }

        const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const statsSql = `
            SELECT 
                c.id as courierId,
                c.name,
                c.phone,
                c.commission_type as commissionType,
                c.commission_value as commissionValue,
                c.commission_enabled as commissionEnabled,
                COUNT(o.id) as ordersCount,
                SUM(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE 0 END) as completedOrdersCount,
                SUM(CASE WHEN o.status = 'PENDING_DELIVERY' THEN 1 ELSE 0 END) as pendingOrdersCount,
                SUM(o.total_amount) as totalOrdersAmount,
                SUM(CASE WHEN o.payment_status = 'PAID' THEN o.total_amount ELSE 0 END) as collectedAmount,
                SUM(CASE WHEN o.payment_status = 'UNPAID' THEN o.total_amount ELSE 0 END) as pendingAmount,
                SUM(o.delivery_commission_amount) as earnedCommission,
                SUM(CASE WHEN o.delivery_commission_status = 'PAID' THEN o.delivery_commission_amount ELSE 0 END) as paidCommission
            FROM delivery_couriers c
            LEFT JOIN orders o ON o.delivery_courier_id = c.id
            ${whereSql}
            GROUP BY c.id
        `;

        const results = this.db.prepare(statsSql).all(...params) as any[];
        return results.map(r => ({
            ...r,
            commissionEnabled: !!r.commissionEnabled,
            pendingCommission: r.earnedCommission - r.paidCommission
        }));
    }

    getDailyStats() {
        const today = new Date().toISOString().split('T')[0];
        return this.getCourierStats({
            startDate: `${today} 00:00:00`,
            endDate: `${today} 23:59:59`
        });
    }

    markCommissionsPaid(input: {
        courierId: number;
        fromDate?: string;
        toDate?: string;
        orderIds?: string[];
    }, userId: number) {
        let sql = `
            UPDATE orders
            SET delivery_commission_status = 'PAID',
                updated_at = CURRENT_TIMESTAMP
            WHERE delivery_courier_id = ?
              AND delivery_commission_status = 'EARNED'
        `;
        const params: any[] = [input.courierId];

        if (input.orderIds && input.orderIds.length > 0) {
            sql += ` AND id IN (${input.orderIds.map(() => '?').join(',')})`;
            params.push(...input.orderIds);
        } else {
            if (input.fromDate) {
                sql += " AND created_at >= ?";
                params.push(input.fromDate);
            }
            if (input.toDate) {
                sql += " AND created_at <= ?";
                params.push(input.toDate);
            }
        }

        const info = this.db.prepare(sql).run(...params);
        return { success: true, count: info.changes };
    }
}

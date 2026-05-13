import Database, { Database as DatabaseType } from 'better-sqlite3';

export class ReportingService {
    private db: DatabaseType;

    constructor(db: DatabaseType) {
        this.db = db;
    }

    getDashboardStats(startDate: string, endDate: string) {
        // 1. Sales & Orders
        // Query journal entries for Sales (Source = POS_SALES, Account Type = REVENUE)
        // Or simpler: Aggregate inventory movements of type 'SALE' for Revenue/COGS approximation?
        // Let's use Accounting data for financial accuracy.

        // Revenue: Credit sum on REVENUE accounts
        const revenue = this.db.prepare(`
            SELECT SUM(jl.credit) as total
            FROM journal_lines jl
            JOIN accounts a ON jl.account_id = a.id
            JOIN journal_entries je ON jl.entry_id = je.id
            WHERE a.type = 'REVENUE'
            AND je.date BETWEEN ? AND ?
            AND je.posted = 1
        `).get(startDate, endDate) as { total: number };

        // COGS: Debit sum on EXPENSE accounts (specifically COGS)
        // Adjust filter for 'Cost of Goods Sold' code '5100' or similar
        const cogs = this.db.prepare(`
            SELECT SUM(jl.debit) as total
            FROM journal_lines jl
            JOIN accounts a ON jl.account_id = a.id
            JOIN journal_entries je ON jl.entry_id = je.id
            WHERE a.code LIKE '51%' 
            AND je.date BETWEEN ? AND ?
            AND je.posted = 1
        `).get(startDate, endDate) as { total: number };

        // Low Stock
        const lowStock = this.db.prepare(`
            SELECT count(*) as count
            FROM products p
            LEFT JOIN (
                SELECT product_id, SUM(quantity_on_hand) as stock_quantity
                FROM inventory_stock
                GROUP BY product_id
            ) stock ON stock.product_id = p.id
            WHERE p.min_stock_level IS NOT NULL
              AND COALESCE(stock.stock_quantity, 0) <= p.min_stock_level
              AND p.type = 'RAW_MATERIAL'
        `).get() as { count: number };

        const lowStockItems = this.db.prepare(`
            SELECT p.id, p.name, COALESCE(stock.stock_quantity, 0) as stock_quantity, p.min_stock_level
            FROM products p
            LEFT JOIN (
                SELECT product_id, SUM(quantity_on_hand) as stock_quantity
                FROM inventory_stock
                GROUP BY product_id
            ) stock ON stock.product_id = p.id
            WHERE p.min_stock_level IS NOT NULL
              AND COALESCE(stock.stock_quantity, 0) <= p.min_stock_level
              AND p.type = 'RAW_MATERIAL'
            ORDER BY stock_quantity ASC
            LIMIT 5
        `).all();

        // Order Count (approx from movements or journals)
        const orders = this.db.prepare(`
            SELECT count(DISTINCT source_id) as count
            FROM journal_entries
            WHERE source_type = 'POS_SALES'
            AND date BETWEEN ? AND ?
        `).get(startDate, endDate) as { count: number };

        const totalSales = revenue.total || 0;
        const totalCOGS = cogs.total || 0;
        const totalOrders = orders.count || 0;

        const cashOpening = this.db.prepare(`
            SELECT SUM(opening_cash) as total
            FROM pos_sessions
            WHERE status = 'OPEN'
        `).get() as { total: number };

        const cashPayments = this.db.prepare(`
            SELECT SUM(p.amount) as total
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            JOIN pos_sessions s ON s.id = COALESCE(p.session_id, o.session_id)
            WHERE s.status = 'OPEN'
              AND p.method = 'CASH'
              AND p.status = 'COMPLETED'
        `).get() as { total: number };

        const cashRefunds = this.db.prepare(`
            SELECT SUM(p.amount) as total
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            JOIN pos_sessions s ON s.id = COALESCE(p.session_id, o.session_id)
            WHERE s.status = 'OPEN'
              AND p.method = 'CASH'
              AND p.status = 'REFUNDED'
        `).get() as { total: number };

        const cashOnHand = (cashOpening.total || 0) + (cashPayments.total || 0) - (cashRefunds.total || 0);

        return {
            totalSales,
            totalCOGS,
            grossMargin: totalSales - totalCOGS,
            totalOrders,
            averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
            lowStockCount: lowStock.count || 0,
            lowStockItems,
            cashOnHand
        };
    }

    getDailySales(startDate: string, endDate: string) {
        return this.db.prepare(`
            SELECT 
                je.date,
                SUM(jl.credit) as revenue
            FROM journal_entries je
            JOIN journal_lines jl ON je.id = jl.entry_id
            JOIN accounts a ON jl.account_id = a.id
            WHERE a.type = 'REVENUE'
            AND je.date BETWEEN ? AND ?
            GROUP BY je.date
            ORDER BY je.date
        `).all(startDate, endDate);
    }

    getSalesReport(filters: { startDate: string; endDate: string; branchId?: number; groupBy?: string }) {
        const branchClause = filters.branchId ? 'AND s.branch_id = ?' : '';
        const params: any[] = [filters.startDate, filters.endDate];
        if (filters.branchId) params.push(filters.branchId);

        const groupBy = filters.groupBy || 'item';
        if (groupBy === 'category') {
            const items = this.db.prepare(`
                SELECT 
                    COALESCE(c.id, 0) as key,
                    COALESCE(c.name, 'Uncategorized') as label,
                    SUM(ol.quantity) as quantity,
                    SUM(ol.total_price) as revenue,
                    SUM(ol.cost_at_time * ol.quantity) as cost
                FROM order_lines ol
                JOIN orders o ON o.id = ol.order_id
                JOIN pos_sessions s ON s.id = o.session_id
                JOIN products p ON p.id = ol.product_id
                LEFT JOIN categories c ON c.id = p.category_id
                WHERE o.created_at BETWEEN ? AND ?
                  AND o.status = 'COMPLETED'
                  ${branchClause}
                GROUP BY COALESCE(c.id, 0)
                ORDER BY revenue DESC
            `).all(...params);
            return { items, groupBy };
        }

        if (groupBy === 'payment') {
            const items = this.db.prepare(`
                WITH order_payment AS (
                    SELECT p1.order_id, p1.method
                    FROM payments p1
                    WHERE p1.status = 'COMPLETED'
                      AND p1.id = (
                          SELECT p2.id
                          FROM payments p2
                          WHERE p2.order_id = p1.order_id
                            AND p2.status = 'COMPLETED'
                          ORDER BY p2.created_at DESC, p2.id DESC
                          LIMIT 1
                      )
                )
                SELECT 
                    COALESCE(op.method, o.payment_method, 'CASH') as key,
                    COALESCE(op.method, o.payment_method, 'CASH') as label,
                    COUNT(DISTINCT o.id) as orders,
                    SUM(o.total_amount) as revenue
                FROM orders o
                JOIN pos_sessions s ON s.id = o.session_id
                LEFT JOIN order_payment op ON op.order_id = o.id
                WHERE o.created_at BETWEEN ? AND ?
                  AND o.status = 'COMPLETED'
                  ${branchClause}
                GROUP BY COALESCE(op.method, o.payment_method, 'CASH')
                ORDER BY revenue DESC
            `).all(...params);
            return { items, groupBy };
        }

        const items = this.db.prepare(`
            SELECT 
                p.id as key,
                p.name as label,
                c.name as category_name,
                SUM(ol.quantity) as quantity,
                SUM(ol.total_price) as revenue,
                SUM(ol.cost_at_time * ol.quantity) as cost
            FROM order_lines ol
            JOIN orders o ON o.id = ol.order_id
            JOIN pos_sessions s ON s.id = o.session_id
            JOIN products p ON p.id = ol.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE o.created_at BETWEEN ? AND ?
              AND o.status = 'COMPLETED'
              ${branchClause}
            GROUP BY p.id
            ORDER BY revenue DESC
        `).all(...params);

        return { items, groupBy };
    }

    getSalesTransactions(filters: { startDate: string; endDate: string; branchId?: number; groupBy: string; key: string }) {
        const branchClause = filters.branchId ? 'AND s.branch_id = ?' : '';
        const params: any[] = [filters.startDate, filters.endDate];
        if (filters.branchId) params.push(filters.branchId);

        if (filters.groupBy === 'payment') {
            const paymentParams: any[] = [filters.startDate, filters.endDate, filters.key];
            if (filters.branchId) paymentParams.push(filters.branchId);

            const items = this.db.prepare(`
                WITH order_payment AS (
                    SELECT p1.order_id, p1.method
                    FROM payments p1
                    WHERE p1.status = 'COMPLETED'
                      AND p1.id = (
                          SELECT p2.id
                          FROM payments p2
                          WHERE p2.order_id = p1.order_id
                            AND p2.status = 'COMPLETED'
                          ORDER BY p2.created_at DESC, p2.id DESC
                          LIMIT 1
                      )
                )
                SELECT 
                    o.id as order_id,
                    o.order_number,
                    o.created_at,
                    o.total_amount,
                    COALESCE(op.method, o.payment_method, 'CASH') as payment_method,
                    je.id as journal_entry_id
                FROM orders o
                JOIN pos_sessions s ON s.id = o.session_id
                LEFT JOIN order_payment op ON op.order_id = o.id
                LEFT JOIN journal_entries je ON je.source_id = o.id AND je.source_type = 'POS_SALES'
                WHERE o.created_at BETWEEN ? AND ?
                  AND o.status = 'COMPLETED'
                  AND COALESCE(op.method, o.payment_method, 'CASH') = ?
                  ${branchClause}
                ORDER BY o.created_at DESC
            `).all(...paymentParams);
            return { items };
        }

        const filterClause = filters.groupBy === 'category' ? 'AND COALESCE(p.category_id, 0) = ?' : 'AND p.id = ?';
        const itemParams: any[] = [filters.startDate, filters.endDate, filters.key];
        if (filters.branchId) itemParams.push(filters.branchId);
        const items = this.db.prepare(`
            SELECT 
                o.id as order_id,
                o.order_number,
                o.created_at,
                p.name as product_name,
                c.name as category_name,
                ol.quantity,
                ol.unit_price,
                ol.total_price,
                ol.cost_at_time,
                je.id as journal_entry_id
            FROM order_lines ol
            JOIN orders o ON o.id = ol.order_id
            JOIN pos_sessions s ON s.id = o.session_id
            JOIN products p ON p.id = ol.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN journal_entries je ON je.source_id = o.id AND je.source_type = 'POS_SALES'
            WHERE o.created_at BETWEEN ? AND ?
              AND o.status = 'COMPLETED'
              ${filterClause}
              ${branchClause}
            ORDER BY o.created_at DESC
        `).all(...itemParams);
        return { items };
    }

    getMarginReport(filters: { startDate: string; endDate: string; branchId?: number; groupBy?: string }) {
        return this.getSalesReport({ ...filters, groupBy: filters.groupBy || 'item' });
    }

    getMarginTransactions(filters: { startDate: string; endDate: string; branchId?: number; groupBy: string; key: string }) {
        return this.getSalesTransactions(filters);
    }

    getSessionsReport(filters: { startDate: string; endDate: string; branchId?: number }) {
        const branchClause = filters.branchId ? 'AND s.branch_id = ?' : '';
        const params: any[] = [filters.startDate, filters.endDate];
        if (filters.branchId) params.push(filters.branchId);
        const items = this.db.prepare(`
            SELECT
                s.id as session_id,
                s.start_time,
                s.end_time,
                s.opening_cash,
                s.closing_cash,
                s.expected_cash,
                s.actual_cash,
                s.cash_difference,
                s.cash_difference_reason,
                s.status,
                b.name as branch_name,
                u.username as user_name,
                approver.username as approved_by_name,
                (
                    SELECT COUNT(*)
                    FROM orders o
                    WHERE o.session_id = s.id AND o.status != 'VOID'
                ) as orders_count,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    LEFT JOIN orders o ON o.id = p.order_id
                    WHERE COALESCE(p.session_id, o.session_id) = s.id
                      AND p.type = 'PAYMENT'
                      AND p.method = 'CASH'
                      AND p.status = 'COMPLETED'
                ) as cash_sales,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    LEFT JOIN orders o ON o.id = p.order_id
                    WHERE COALESCE(p.session_id, o.session_id) = s.id
                      AND p.type = 'PAYMENT'
                      AND p.method = 'CARD'
                      AND p.status = 'COMPLETED'
                ) as card_sales,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    LEFT JOIN orders o ON o.id = p.order_id
                    WHERE COALESCE(p.session_id, o.session_id) = s.id
                      AND p.type = 'PAYMENT'
                      AND p.method = 'TRANSFER'
                      AND p.status = 'COMPLETED'
                ) as transfer_sales,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    LEFT JOIN orders o ON o.id = p.order_id
                    WHERE COALESCE(p.session_id, o.session_id) = s.id
                      AND p.type = 'PAYMENT'
                      AND p.method = 'CREDIT'
                      AND p.status = 'COMPLETED'
                ) as credit_sales,
                (
                    SELECT COALESCE(SUM(o.total_amount), 0)
                    FROM orders o
                    WHERE o.session_id = s.id
                      AND o.status = 'PENDING_DELIVERY'
                      AND o.payment_status = 'UNPAID'
                ) as delivery_pending,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    WHERE p.session_id = s.id
                      AND p.type = 'DELIVERY_COLLECTION'
                      AND p.status = 'COMPLETED'
                ) as delivery_collected,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    WHERE p.session_id = s.id
                      AND p.type = 'DELIVERY_COLLECTION'
                      AND p.method = 'CASH'
                      AND p.status = 'COMPLETED'
                ) as delivery_cash_collected,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    WHERE p.session_id = s.id
                      AND p.type = 'REFUND'
                      AND p.method = 'CASH'
                      AND p.status = 'REFUNDED'
                ) as cash_refunds,
                (
                    SELECT COALESCE(SUM(total_refund), 0)
                    FROM returns r
                    JOIN orders o ON o.id = r.original_order_id
                    WHERE o.session_id = s.id
                ) as returns,
                (
                    SELECT COALESCE(SUM(total_amount), 0)
                    FROM orders o
                    WHERE o.session_id = s.id AND o.status = 'VOID'
                ) as voids,
                (
                    SELECT COALESCE(SUM(discount_amount), 0)
                    FROM orders o
                    WHERE o.session_id = s.id AND o.status != 'VOID'
                ) as discounts,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM cash_movements cm
                    WHERE cm.session_id = s.id
                      AND cm.type = 'CASH_IN'
                      AND cm.status = 'COMPLETED'
                ) as cash_in,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM cash_movements cm
                    WHERE cm.session_id = s.id
                      AND cm.type = 'CASH_OUT'
                      AND cm.status = 'COMPLETED'
                ) as cash_out,
                (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM payments p
                    LEFT JOIN orders o ON o.id = p.order_id
                    WHERE COALESCE(p.session_id, o.session_id) = s.id
                      AND p.status = 'COMPLETED'
                      AND p.type IN ('PAYMENT', 'DELIVERY_COLLECTION')
                ) as total_sales
            FROM pos_sessions s
            LEFT JOIN branches b ON b.id = s.branch_id
            LEFT JOIN users u ON u.id = s.user_id
            LEFT JOIN users approver ON approver.id = s.close_approved_by
            WHERE s.start_time BETWEEN ? AND ?
              ${branchClause}
            ORDER BY s.start_time DESC
        `).all(...params) as Array<Record<string, string | number | null>>;

        return {
            items: items.map(item => {
                const amount = (key: string) => Number(item[key] || 0);
                const computedExpectedCash = amount('opening_cash')
                    + amount('cash_sales')
                    + amount('delivery_cash_collected')
                    + amount('cash_in')
                    - amount('cash_refunds')
                    - amount('cash_out');
                return {
                    ...item,
                    expected_cash: item.status === 'OPEN' || item.expected_cash === null || item.expected_cash === 0
                        ? computedExpectedCash
                        : item.expected_cash,
                    actual_cash: item.actual_cash ?? item.closing_cash ?? null,
                    difference: item.cash_difference ?? (
                        item.actual_cash === null || item.actual_cash === undefined
                            ? null
                            : Number(item.actual_cash) - computedExpectedCash
                    )
                };
            })
        };
    }

    getSessionOrders(filters: { sessionId: string }) {
        const items = this.db.prepare(`
            SELECT 
                o.id as order_id,
                o.order_number,
                o.created_at,
                o.total_amount,
                o.payment_method,
                je.id as journal_entry_id
            FROM orders o
            LEFT JOIN journal_entries je ON je.source_id = o.id AND je.source_type = 'POS_SALES'
            WHERE o.session_id = ?
            ORDER BY o.created_at DESC
        `).all(filters.sessionId);
        return { items };
    }

    getInventoryMovementsReport(filters: { startDate: string; endDate: string; branchId?: number; groupBy?: string }) {
        const branchClause = filters.branchId ? 'AND m.branch_id = ?' : '';
        const params: any[] = [filters.startDate, filters.endDate];
        if (filters.branchId) params.push(filters.branchId);
        const groupBy = filters.groupBy || 'detail';

        if (groupBy === 'product') {
            const items = this.db.prepare(`
                SELECT 
                    p.id as key,
                    p.name as label,
                    SUM(CASE WHEN m.quantity > 0 THEN m.quantity ELSE 0 END) as qty_in,
                    SUM(CASE WHEN m.quantity < 0 THEN ABS(m.quantity) ELSE 0 END) as qty_out,
                    SUM(m.quantity) as net
                FROM inventory_movements m
                JOIN products p ON p.id = m.product_id
                WHERE m.date BETWEEN ? AND ?
                  ${branchClause}
                GROUP BY p.id
                ORDER BY p.name
            `).all(...params);
            return { items, groupBy };
        }

        if (groupBy === 'type') {
            const items = this.db.prepare(`
                SELECT 
                    m.type as key,
                    m.type as label,
                    SUM(m.quantity) as net
                FROM inventory_movements m
                WHERE m.date BETWEEN ? AND ?
                  ${branchClause}
                GROUP BY m.type
                ORDER BY m.type
            `).all(...params);
            return { items, groupBy };
        }

        const items = this.db.prepare(`
            SELECT 
                m.*,
                p.name as product_name,
                b.name as branch_name,
                je.id as journal_entry_id
            FROM inventory_movements m
            JOIN products p ON p.id = m.product_id
            LEFT JOIN branches b ON b.id = m.branch_id
            LEFT JOIN journal_entries je ON je.source_id = m.reference_id
            WHERE m.date BETWEEN ? AND ?
              ${branchClause}
            ORDER BY m.date DESC
        `).all(...params);
        return { items, groupBy };
    }

    getInventoryMovementTransactions(filters: { startDate: string; endDate: string; branchId?: number; groupBy: string; key: string }) {
        const branchClause = filters.branchId ? 'AND m.branch_id = ?' : '';
        const filterClause = filters.groupBy === 'product' ? 'AND m.product_id = ?' : 'AND m.type = ?';

        // Build params in EXACT same order as SQL placeholders:
        // WHERE m.date BETWEEN ?[0] AND ?[1]  ${filterClause} ?[2]  ${branchClause} ?[3]
        const params: any[] = [filters.startDate, filters.endDate];
        params.push(filters.key); // filterClause placeholder
        if (filters.branchId) params.push(filters.branchId); // branchClause placeholder

        const items = this.db.prepare(`
            SELECT 
                m.*,
                p.name as product_name,
                b.name as branch_name,
                je.id as journal_entry_id
            FROM inventory_movements m
            JOIN products p ON p.id = m.product_id
            LEFT JOIN branches b ON b.id = m.branch_id
            LEFT JOIN journal_entries je ON je.source_id = m.reference_id
            WHERE m.date BETWEEN ? AND ?
              ${filterClause}
              ${branchClause}
            ORDER BY m.date DESC
        `).all(...params);
        return { items };
    }

    getInventoryValuationReport(filters: { asOfDate: string; branchId?: number }) {
        const branchClause = filters.branchId ? 'AND m.branch_id = ?' : '';
        const params: any[] = [filters.asOfDate];
        if (filters.branchId) params.push(filters.branchId);

        const items = this.db.prepare(`
            WITH movement_values AS (
                SELECT
                    m.product_id,
                    m.branch_id,
                    SUM(COALESCE(m.base_quantity, m.quantity)) as quantity_on_hand,
                    SUM(COALESCE(m.base_quantity, m.quantity) * COALESCE(m.unit_cost, 0)) as signed_value
                FROM inventory_movements m
                WHERE m.date <= ?
                  ${branchClause}
                GROUP BY m.product_id, m.branch_id
            )
            SELECT
                mv.product_id,
                p.name as product_name,
                mv.branch_id,
                b.name as branch_name,
                mv.quantity_on_hand,
                CASE
                    WHEN mv.quantity_on_hand != 0 THEN ABS(mv.signed_value / mv.quantity_on_hand)
                    ELSE COALESCE(p.cost, 0)
                END as unit_cost,
                CASE
                    WHEN mv.quantity_on_hand != 0 THEN mv.quantity_on_hand * ABS(mv.signed_value / mv.quantity_on_hand)
                    ELSE 0
                END as inventory_value
            FROM movement_values mv
            JOIN products p ON p.id = mv.product_id
            LEFT JOIN branches b ON b.id = mv.branch_id
            ORDER BY p.name, b.name
        `).all(...params) as any[];

        const totals = items.reduce((acc, row) => ({
            quantity_on_hand: acc.quantity_on_hand + Number(row.quantity_on_hand || 0),
            inventory_value: acc.inventory_value + Number(row.inventory_value || 0)
        }), { quantity_on_hand: 0, inventory_value: 0 });

        return { asOfDate: filters.asOfDate, branchId: filters.branchId ?? null, items, totals };
    }
}

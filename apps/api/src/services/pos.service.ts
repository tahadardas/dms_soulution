import { Database } from 'better-sqlite3';
import { randomUUID } from 'crypto';
import { AccountingService } from './accountingService';
import { InventoryService } from './inventoryService';
import { SettingsService } from './settingsService';
import { PrintingService } from './printingService';
import { PolicyService } from './policy.service';
import { DeliveryCourierService } from './deliveryCourier.service';

interface OpenSessionDTO {
    userId: number;
    branchId: number;
    openingCash: number;
    stationId?: string;
}

interface CloseSessionDTO {
    sessionId: string;
    closingCash: number;
    notes?: string;
    managerUsername?: string;
    managerPassword?: string;
    reason?: string;
    userId: number;
}

interface CreateOrderDTO {
    sessionId: string;
    customerId?: number;
    items: { productId: number; quantity: number; note?: string }[];
    notes?: string[];
    tableNumber?: string;
    orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    paymentMode?: 'PAY_NOW' | 'PAY_LATER';
    paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
    deliveryPersonName?: string;
    deliveryPhone?: string;
    deliveryAddress?: string;
    deliveryNotes?: string;
    deliveryCourierId?: number;
    deliveryCourierOneTime?: boolean;
    deliveryCommissionAmount?: number;
    deliveryCommissionType?: 'NONE' | 'FIXED_PER_ORDER' | 'PERCENT_OF_ORDER' | 'MANUAL';
    printNow?: boolean;
    printTypes?: Array<'RECEIPT' | 'KOT'>;
    discountAmount?: number;
    discountType?: 'PERCENTAGE' | 'FIXED';
    serviceCharge?: number;
    tipsAmount?: number;
    managerUsername?: string;
    managerPassword?: string;
    discountReason?: string;
}

interface CreateReturnDTO {
    orderId: string;
    reason: string;
    items: { orderLineId: number; quantity: number }[];
    managerUsername?: string;
    managerPassword?: string;
    sessionId?: string;
}

interface CashMovementDTO {
    sessionId: string;
    amount: number;
    reason: string;
    method?: 'CASH';
    managerUsername?: string;
    managerPassword?: string;
}

type PreparedReturnLine = {
    lineId: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    productCost: number;
    productName: string;
};

type PreparedOrderLine = {
    id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    product_cost: number;
    product_name: string;
    has_recipe: number;
};

type PreparedReturn = {
    orderLines: PreparedOrderLine[];
    lineItems: PreparedReturnLine[];
    totalRefund: number;
    totalCogs: number;
};

export class POSService {
    private inventoryService: InventoryService;
    private accountingService: AccountingService;
    private settingsService: SettingsService;
    private printingService: PrintingService;
    private policyService: PolicyService;
    private deliveryCourierService: DeliveryCourierService;

    constructor(private db: Database) {
        this.inventoryService = new InventoryService(db);
        this.accountingService = new AccountingService(db);
        this.settingsService = new SettingsService(db);
        this.printingService = new PrintingService(db);
        this.policyService = new PolicyService(db);
        this.deliveryCourierService = new DeliveryCourierService(db);
    }

    openSession(data: OpenSessionDTO) {
        this.policyService.validateOpenSession({ 
            userId: data.userId, 
            openingCash: data.openingCash 
        });

        const id = randomUUID();
        this.db.prepare(`
            INSERT INTO pos_sessions (id, user_id, branch_id, start_time, opening_cash, status, station_id)
            VALUES (?, ?, ?, datetime('now'), ?, 'OPEN', ?)
        `).run(id, data.userId, data.branchId, data.openingCash, data.stationId || null);

        this.policyService.writeAuditLog({
            userId: data.userId,
            action: 'POS.SESSION_OPEN',
            entityType: 'POS_SESSION',
            entityId: id,
            newValue: { openingCash: data.openingCash, stationId: data.stationId }
        });

        return { id, status: 'OPEN' };
    }

    async closeSession(data: CloseSessionDTO) {
        // 1. Get pending delivery count for this session
        const pending = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM orders 
            WHERE session_id = ? AND status = 'PENDING_DELIVERY'
        `).get(data.sessionId) as { count: number };

        // 2. Validate with policy
        const { expectedCash, cashDifference, closeApprovedBy } = await this.policyService.validateCloseSession({
            sessionId: data.sessionId,
            actualCash: data.closingCash,
            pendingDeliveryCount: pending.count,
            managerUsername: data.managerUsername,
            managerPassword: data.managerPassword,
            reason: data.reason,
            userId: data.userId
        });

        // 3. Update session
        const info = this.db.prepare(`
            UPDATE pos_sessions 
            SET 
                end_time = datetime('now'), 
                closing_cash = ?, 
                actual_cash = ?,
                expected_cash = ?,
                cash_difference = ?,
                cash_difference_reason = ?,
                status = 'CLOSED', 
                notes = ?,
                closed_by = ?,
                close_approved_by = ?
            WHERE id = ? AND status = 'OPEN'
        `).run(
            data.closingCash, 
            data.closingCash,
            expectedCash,
            cashDifference,
            data.reason || null,
            data.notes || null, 
            data.userId,
            closeApprovedBy || null,
            data.sessionId
        );

        if (info.changes === 0) {
            throw new Error('Session not found or already closed');
        }

        // 4. Audit Log
        this.policyService.writeAuditLog({
            userId: data.userId,
            action: 'POS.SESSION_CLOSE',
            entityType: 'POS_SESSION',
            entityId: data.sessionId,
            newValue: { 
                actualCash: data.closingCash, 
                expectedCash, 
                cashDifference,
                reason: data.reason,
                approvedBy: closeApprovedBy
            },
            approvedBy: closeApprovedBy,
            reason: data.reason
        });

        this.queueZReport(data.sessionId);
        return { success: true, expectedCash, cashDifference, approvedBy: closeApprovedBy };
    }

    getActiveSession(userId: number, stationId?: string) {
        let sql = "SELECT id, status, branch_id, start_time FROM pos_sessions WHERE user_id = ? AND status = 'OPEN'";
        const params: any[] = [userId];

        if (stationId) {
            sql += " AND station_id = ?";
            params.push(stationId);
        }

        sql += " ORDER BY start_time DESC LIMIT 1";
        
        return this.db.prepare(sql).get(...params);
    }

    getSessionStats(sessionId: string) {
        const session = this.db.prepare('SELECT opening_cash FROM pos_sessions WHERE id = ?').get(sessionId) as { opening_cash: number } | undefined;

        const sales = this.db.prepare(`
            SELECT COUNT(*) as count, SUM(total_amount) as total, SUM(discount_amount) as total_discounts
            FROM orders
            WHERE session_id = ? AND status != 'VOID'
        `).get(sessionId) as { count: number; total: number; total_discounts: number } | undefined;

        const returns = this.db.prepare(`
            SELECT COUNT(*) as count, SUM(total_refund) as total
            FROM returns r
            JOIN orders o ON o.id = r.original_order_id
            WHERE o.session_id = ?
        `).get(sessionId) as { count: number; total: number } | undefined;

        // Calculate actual cash from payments
        const cashPayments = this.db.prepare(`
            SELECT SUM(p.amount) as total
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            WHERE COALESCE(p.session_id, o.session_id) = ?
              AND p.method = 'CASH'
              AND p.status = 'COMPLETED'
        `).get(sessionId) as { total: number };

        const cashRefunds = this.db.prepare(`
            SELECT SUM(p.amount) as total
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            WHERE COALESCE(p.session_id, o.session_id) = ?
              AND p.method = 'CASH'
              AND p.status = 'REFUNDED'
        `).get(sessionId) as { total: number };

        const cashIn = this.db.prepare(`
            SELECT SUM(amount) as total
            FROM cash_movements
            WHERE session_id = ?
              AND type = 'CASH_IN'
              AND status = 'COMPLETED'
        `).get(sessionId) as { total: number };

        const cashOut = this.db.prepare(`
            SELECT SUM(amount) as total
            FROM cash_movements
            WHERE session_id = ?
              AND type = 'CASH_OUT'
              AND status = 'COMPLETED'
        `).get(sessionId) as { total: number };

        const totalSales = sales?.total || 0;
        const totalReturns = returns?.total || 0;
        const totalDiscounts = sales?.total_discounts || 0;
        const netAmount = totalSales - totalReturns;
        
        const openingCash = session?.opening_cash || 0;
        const cashInTotal = cashIn?.total || 0;
        const cashOutTotal = cashOut?.total || 0;
        const netCashFlow = (cashPayments?.total || 0) + cashInTotal - (cashRefunds?.total || 0) - cashOutTotal;
        const expectedCash = openingCash + netCashFlow;

        return {
            totalSales,
            salesCount: sales?.count || 0,
            totalReturns,
            totalDiscounts,
            returnsCount: returns?.count || 0,
            netAmount,
            openingCash,
            cashIn: cashInTotal,
            cashOut: cashOutTotal,
            netCashFlow,
            expectedCash
        };
    }

    private async recordCashMovement(type: 'CASH_IN' | 'CASH_OUT', data: CashMovementDTO, userId: number) {
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error('مبلغ الحركة النقدية يجب أن يكون أكبر من صفر.');
        }
        const reason = String(data.reason || '').trim();
        if (!reason) {
            throw new Error('سبب الحركة النقدية مطلوب.');
        }
        if (data.method && data.method !== 'CASH') {
            throw new Error('Cash In / Cash Out يدعمان النقد فقط.');
        }

        const session = this.db.prepare(`
            SELECT id, branch_id
            FROM pos_sessions
            WHERE id = ? AND status = 'OPEN'
        `).get(data.sessionId) as { id: string; branch_id?: number | null } | undefined;

        if (!session) {
            throw new Error('لا يمكن تسجيل حركة نقدية بدون جلسة صندوق مفتوحة.');
        }

        let approvedBy: number | undefined;
        const posSettings = this.settingsService.getSettings('pos') || {};
        const cashOutThreshold = Number(posSettings.managerRequiredCashOutAmount || 0);
        if (type === 'CASH_OUT' && cashOutThreshold > 0 && amount >= cashOutThreshold) {
            if (!data.managerUsername) {
                throw new Error('إخراج نقدي بهذا المبلغ يتطلب موافقة مدير.');
            }
            const approval = await this.policyService.requireManagerApproval(
                data.managerUsername,
                data.managerPassword,
                'POS_CASH_OUT',
                'POS_SESSION',
                data.sessionId,
                userId,
                reason,
                'POS_CASH_OUT_APPROVE'
            );
            approvedBy = approval.managerId;
        }

        const id = randomUUID();
        this.db.prepare(`
            INSERT INTO cash_movements (id, session_id, branch_id, type, method, amount, reason, status, approved_by, created_by)
            VALUES (?, ?, ?, ?, 'CASH', ?, ?, 'COMPLETED', ?, ?)
        `).run(id, data.sessionId, session.branch_id ?? null, type, amount, reason, approvedBy || null, userId);

        this.policyService.writeAuditLog({
            userId,
            action: type === 'CASH_IN' ? 'POS.CASH_IN' : 'POS.CASH_OUT',
            entityType: 'CASH_MOVEMENT',
            entityId: id,
            newValue: { sessionId: data.sessionId, type, amount, reason },
            reason,
            approvedBy
        });

        return { id, sessionId: data.sessionId, type, amount, reason, approvedBy: approvedBy || null };
    }

    cashIn(data: CashMovementDTO, userId: number) {
        return this.recordCashMovement('CASH_IN', data, userId);
    }

    cashOut(data: CashMovementDTO, userId: number) {
        return this.recordCashMovement('CASH_OUT', data, userId);
    }

    listAllOpenSessions() {
        const sessions = this.db.prepare(`
            SELECT s.id, s.user_id, u.username as user_name, s.branch_id, b.name as branch_name, 
                   s.start_time, s.opening_cash
            FROM pos_sessions s
            JOIN users u ON u.id = s.user_id
            LEFT JOIN branches b ON b.id = s.branch_id
            WHERE s.status = 'OPEN'
            ORDER BY s.start_time DESC
        `).all() as any[];

        return sessions.map(s => ({
            ...s,
            stats: this.getSessionStats(s.id)
        }));
    }

    private getAccountIds() {
        const accountingSettings = this.settingsService.getSettings('accounting') || {};
        const mapping = accountingSettings.chartOfAccountsMapping || {
            posCash: '1010',
            posBank: '1020',
            revenue: '4100',
            discounts: '4200',
            taxPayable: '2200',
            serviceCharge: '4300',
            tipsPayable: '2300',
            inventory: '1200',
            cogs: '5100'
        };

        const getAccountId = (code: string, required = true) => {
            const row = this.db.prepare('SELECT id FROM accounts WHERE code = ?').get(code) as { id: number } | undefined;
            if (!row) {
                if (required) throw new Error(`Account not found for code ${code}`);
                return null;
            }
            return row.id;
        };

        return {
            cashId: getAccountId(mapping.posCash || '1010'),
            bankId: getAccountId(mapping.posBank || '1020'),
            inventoryId: getAccountId(mapping.inventory || '1200'),
            salesId: getAccountId(mapping.revenue || '4100'),
            cogsId: getAccountId(mapping.cogs || '5100'),
            discountsId: getAccountId(mapping.discounts || '4200', false),
            serviceChargeId: getAccountId(mapping.serviceCharge || '4300', false),
            tipsPayableId: getAccountId(mapping.tipsPayable || '2300', false),
            postingPolicy: accountingSettings.postingPolicy || 'IMMEDIATE'
        };
    }

    private getSequenceDateKey(now = new Date()): string {
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}${month}${day}`;
    }

    private buildOrderNumber(branchId: number, sequenceDate: string, value: number): string {
        return `BR${branchId}-${sequenceDate}-${String(value).padStart(6, '0')}`;
    }

    private nextOrderNumber(branchId: number): string {
        const sequenceDate = this.getSequenceDateKey();
        const scope = 'ORDER';

        this.db.prepare(`
            INSERT OR IGNORE INTO sequences (scope, sequence_date, branch_id, current_value)
            VALUES (?, ?, ?, 0)
        `).run(scope, sequenceDate, branchId);

        for (let attempt = 0; attempt < 100; attempt += 1) {
            this.db.prepare(`
                UPDATE sequences
                SET current_value = current_value + 1
                WHERE scope = ? AND sequence_date = ? AND branch_id = ?
            `).run(scope, sequenceDate, branchId);

            const row = this.db.prepare(`
                SELECT current_value
                FROM sequences
                WHERE scope = ? AND sequence_date = ? AND branch_id = ?
            `).get(scope, sequenceDate, branchId) as { current_value: number } | undefined;

            if (!row) {
                throw new Error('Order sequence is not available.');
            }

            const orderNumber = this.buildOrderNumber(branchId, sequenceDate, row.current_value);
            const existing = this.db.prepare('SELECT 1 FROM orders WHERE order_number = ?').get(orderNumber);
            if (!existing) {
                return orderNumber;
            }
        }

        throw new Error('Unable to generate a unique order number.');
    }

    createOrder(data: CreateOrderDTO, userId: number) {
        if (!data.items || data.items.length === 0) {
            throw new Error('Order must include at least one item');
        }

        const session = this.db.prepare("SELECT id, branch_id, status FROM pos_sessions WHERE id = ?")
            .get(data.sessionId) as { id: string; branch_id?: number | null; status: string } | undefined;
        if (!session) {
            throw new Error('Session not found');
        }
        if (session.status !== 'OPEN') {
            throw new Error('Session is not active or already closed');
        }
        if (session.branch_id === null || session.branch_id === undefined) {
            throw new Error('Session branch is required to generate an order number.');
        }
        const branchId = Number(session.branch_id);
        if (!Number.isInteger(branchId) || branchId <= 0) {
            throw new Error('Session branch is invalid.');
        }

        // --- Policy Validation ---
        this.policyService.validateOrderSave({
            sessionId: data.sessionId,
            itemsCount: data.items.length,
            orderType: data.orderType || 'DINE_IN',
            isPaid: data.paymentMode !== 'PAY_LATER',
            paymentsTotal: 0, // Calculated later
            orderTotal: 0 // Calculated later
        });

        this.policyService.validateInventoryAvailability(data.items, branchId);

        const txn = this.db.transaction(() => {
            const orderId = randomUUID();
            const orderNumber = this.nextOrderNumber(branchId);

            let totalAmount = 0;
            let totalCogs = 0;
            const productStmt = this.db.prepare('SELECT id, price, cost, type FROM products WHERE id = ?');
            const inventorySettings = this.settingsService.getSettings('inventory') || {};
            const autoDeduct = inventorySettings.autoDeductStockOnSale !== false;

            // 1. Determine order type and delivery status
            const orderType = data.orderType || 'DINE_IN';
            const isDeliveryPending = orderType === 'DELIVERY' && data.paymentMode === 'PAY_LATER';
            const paymentMethod = isDeliveryPending ? 'CASH' : (data.paymentMethod || 'CASH');
            if (!['CASH', 'CARD', 'TRANSFER', 'CREDIT'].includes(paymentMethod)) {
                throw new Error('Unsupported payment method.');
            }

            // For Credit payments, we MUST have a customer and they MUST have a receivable account
            let customerAccountId: number | null = null;
            if (paymentMethod === 'CREDIT') {
                if (!data.customerId) {
                    throw new Error('Customer is required for credit payments.');
                }
                const customer = this.db.prepare('SELECT receivable_account_id FROM customers WHERE id = ?').get(data.customerId) as { receivable_account_id: number } | undefined;
                if (!customer?.receivable_account_id) {
                    throw new Error('Selected customer does not have a linked accounting account.');
                }
                customerAccountId = customer.receivable_account_id;
            }

            const orderStatus = isDeliveryPending ? 'PENDING_DELIVERY' : 'COMPLETED';
            const paymentStatus = isDeliveryPending ? 'UNPAID' : 'PAID';
            const deliveryStatus = orderType === 'DELIVERY'
                ? (isDeliveryPending ? 'OUT_FOR_DELIVERY' : 'DELIVERED')
                : null;

            // 1. Create Order
            let deliveryCommissionAmount = 0;
            let deliveryCommissionStatus = 'NOT_APPLICABLE';
            let deliveryCommissionType = data.deliveryCommissionType || 'NONE';

            if (orderType === 'DELIVERY' && (data.deliveryCourierId || data.deliveryPersonName)) {
                deliveryCommissionStatus = 'EARNED';
                // Calculate commission if not manually provided
                if (data.deliveryCommissionAmount !== undefined) {
                    deliveryCommissionAmount = data.deliveryCommissionAmount;
                } else {
                    // This is a placeholder total, we'll update it later if it's percentage based
                    // but for now we calculate based on the current data
                    // Wait, total_amount is not yet final here. 
                    // Actually, most systems calculate commission on the final total.
                    // I'll calculate it after finalAmount is known.
                }
            }

            this.db.prepare(`
                INSERT INTO orders (
                    id, session_id, customer_id, branch_id, order_number, status, total_amount, 
                    table_number, payment_method, order_type, payment_status, delivery_status, 
                    delivery_person_name, delivery_phone, delivery_address, delivery_notes,
                    delivery_courier_id, delivery_courier_name, delivery_courier_phone, 
                    delivery_courier_one_time, delivery_commission_amount, 
                    delivery_commission_type, delivery_commission_status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                orderId, data.sessionId, data.customerId || null, branchId, orderNumber, 
                orderStatus, 0, data.tableNumber || null, paymentMethod, orderType, 
                paymentStatus, deliveryStatus, data.deliveryPersonName || null, 
                data.deliveryPhone || null, data.deliveryAddress || null, 
                data.deliveryNotes || null,
                data.deliveryCourierId || null,
                data.deliveryPersonName || null,
                data.deliveryPhone || null,
                data.deliveryCourierOneTime ? 1 : 0,
                0, // delivery_commission_amount (update later)
                deliveryCommissionType,
                deliveryCommissionStatus
            );

            const insertLine = this.db.prepare(`
                INSERT INTO order_lines (order_id, product_id, quantity, unit_price, cost_at_time, total_price, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of data.items) {
                if (item.quantity <= 0) {
                    throw new Error('Item quantity must be greater than zero');
                }
                const product = productStmt.get(item.productId) as { id: number; price: number; cost: number; type: string } | undefined;
                if (!product) {
                    throw new Error(`Product ${item.productId} not found`);
                }
                const unitPrice = product.price || 0;
                const lineTotal = unitPrice * item.quantity;
                let lineUnitCost = product.cost || 0;
                totalAmount += lineTotal;
                if (autoDeduct) {
                    const stockResult = this.inventoryService.processSale(
                        item.productId, 
                        item.quantity, 
                        orderId, 
                        branchId, 
                        userId,
                        inventorySettings.allowNegativeStock === true
                    );
                    lineUnitCost = stockResult.unitCost;
                    totalCogs += stockResult.totalCost;
                } else {
                    totalCogs += lineUnitCost * item.quantity;
                }
                insertLine.run(orderId, item.productId, item.quantity, unitPrice, lineUnitCost, lineTotal, item.note || null);
            }

            let actualDiscount = 0;
            if (data.discountAmount) {
                if (data.discountType === 'PERCENTAGE') {
                    actualDiscount = totalAmount * (data.discountAmount / 100);
                } else {
                    actualDiscount = data.discountAmount;
                }
                if (actualDiscount > totalAmount) actualDiscount = totalAmount;
            }

            const serviceCharge = Number(data.serviceCharge || 0);
            const tipsAmount = Number(data.tipsAmount || 0);
            const finalAmount = totalAmount - actualDiscount + serviceCharge + tipsAmount;

            // Update commission based on final total
            if (deliveryCommissionStatus === 'EARNED' && data.deliveryCommissionAmount === undefined) {
                deliveryCommissionAmount = this.deliveryCourierService.calculateCommission({
                    courierId: data.deliveryCourierId,
                    orderTotal: finalAmount,
                    commissionType: data.deliveryCommissionType,
                    commissionValue: undefined // service will fetch it if courierId is provided
                });
            }

            this.db.prepare(`
                UPDATE orders 
                SET total_amount = ?, 
                    discount_amount = ?, 
                    discount_type = ?, 
                    service_charge = ?, 
                    tips_amount = ?,
                    delivery_commission_amount = ?
                WHERE id = ?
            `).run(
                finalAmount, 
                actualDiscount, 
                data.discountType || 'PERCENTAGE', 
                serviceCharge, 
                tipsAmount, 
                deliveryCommissionAmount,
                orderId
            );

            // 2. Notes
            if (Array.isArray(data.notes) && data.notes.length > 0) {
                const insertNote = this.db.prepare('INSERT INTO order_notes (order_id, content, created_by) VALUES (?, ?, ?)');
                for (const note of data.notes) {
                    insertNote.run(orderId, note, userId);
                }
            }

            // 3. Accounting Entry — skip cash debit for pending delivery
            const accounts = this.getAccountIds();
            if (!isDeliveryPending) {
                const paymentAccountId = paymentMethod === 'CREDIT' 
                    ? customerAccountId! 
                    : (paymentMethod === 'CASH' ? accounts.cashId! : accounts.bankId!);
                
                const paymentDescription = paymentMethod === 'CASH'
                    ? 'Cash sale receipt'
                    : paymentMethod === 'CARD'
                        ? 'Card sale settlement'
                        : paymentMethod === 'TRANSFER'
                            ? 'Transfer sale settlement'
                            : 'Credit sale (On Account)';
                // Normal paid order — cash enters drawer
                const entry = this.accountingService.createJournalEntry({
                    date: new Date().toISOString(),
                    description: `POS Sale ${orderNumber}`,
                    source_type: 'POS_SALES',
                    source_id: orderId,
                    branch_id: branchId,
                    lines: [
                        { account_id: paymentAccountId, debit: finalAmount, credit: 0, description: paymentDescription },
                        ...(actualDiscount > 0 && accounts.discountsId ? [{ account_id: accounts.discountsId, debit: actualDiscount, credit: 0, description: 'Sale discount' }] : []),
                        { account_id: accounts.salesId!, debit: 0, credit: totalAmount, description: 'Sales revenue' },
                        ...(serviceCharge > 0 && accounts.serviceChargeId ? [{ account_id: accounts.serviceChargeId, debit: 0, credit: serviceCharge, description: 'Service charge' }] : []),
                        ...(tipsAmount > 0 && accounts.tipsPayableId ? [{ account_id: accounts.tipsPayableId, debit: 0, credit: tipsAmount, description: 'Tips payable' }] : []),
                        { account_id: accounts.cogsId!, debit: totalCogs, credit: 0, description: 'COGS' },
                        { account_id: accounts.inventoryId!, debit: 0, credit: totalCogs, description: 'Inventory reduction' }
                    ].filter(l => l.account_id !== null)
                });
                if (accounts.postingPolicy === 'IMMEDIATE') {
                    this.accountingService.postEntry(entry.id!);
                }

                // Create payment record
                this.db.prepare(`
                    INSERT INTO payments (id, order_id, session_id, type, method, amount, status, created_by)
                    VALUES (?, ?, ?, 'PAYMENT', ?, ?, 'COMPLETED', ?)
                `).run(randomUUID(), orderId, data.sessionId, paymentMethod, finalAmount, userId);
            } else {
                // Pending delivery — only COGS/inventory, NO cash entry
                const entry = this.accountingService.createJournalEntry({
                    date: new Date().toISOString(),
                    description: `POS Delivery (Pending) ${orderNumber}`,
                    source_type: 'POS_SALES',
                    source_id: orderId,
                    branch_id: branchId,
                    lines: [
                        { account_id: accounts.cogsId!, debit: totalCogs, credit: 0, description: 'COGS' },
                        { account_id: accounts.inventoryId!, debit: 0, credit: totalCogs, description: 'Inventory reduction' }
                    ]
                });
                if (accounts.postingPolicy === 'IMMEDIATE' && totalCogs > 0) {
                    this.accountingService.postEntry(entry.id!);
                }
            }


            return { orderId, orderNumber, totalAmount, orderType, paymentStatus, deliveryStatus };
        });

        const result = txn();

        this.policyService.writeAuditLog({
            userId,
            action: 'POS.ORDER_CREATE',
            entityType: 'ORDER',
            entityId: result.orderId,
            newValue: result
        });

        // Removed automatic printing on order save - printing should be explicit via print endpoint
        // if (data.printNow) {
        //     const types = data.printTypes || ['RECEIPT', 'KOT'];
        //     this.queueOrderPrintJobs(result.orderId, session.branch_id ?? null, false, types);
        // }

        return result;
    }

    async submitOrder(data: CreateOrderDTO, userId: number) {
        // Pre-transaction validation for async policies
        let totalRaw = 0;
        for (const item of data.items) {
            const p = this.db.prepare('SELECT price FROM products WHERE id = ?').get(item.productId) as { price: number };
            totalRaw += (p?.price || 0) * item.quantity;
        }

        let actualDiscount = 0;
        if (data.discountAmount) {
            if (data.discountType === 'PERCENTAGE') {
                actualDiscount = totalRaw * (data.discountAmount / 100);
            } else {
                actualDiscount = data.discountAmount;
            }
        }
        
        const discPercent = totalRaw > 0 ? (actualDiscount / totalRaw) * 100 : 0;
        const { approvedBy } = await this.policyService.validateDiscount({
            discountPercent: discPercent,
            discountAmount: actualDiscount,
            totalAmount: totalRaw,
            managerUsername: data.managerUsername,
            managerPassword: data.managerPassword,
            userId,
            reason: data.discountReason
        });

        // Now run the transaction
        const result = this.createOrder(data, userId);
        
        if (approvedBy) {
            this.db.prepare('UPDATE orders SET discount_approved_by = ?, discount_reason = ? WHERE id = ?')
                .run(approvedBy, data.discountReason || null, result.orderId);
        }

        return result;
    }

    private prepareReturnLines(orderId: string, items: CreateReturnDTO['items']): PreparedReturn {
        const requested = new Map<number, number>();
        for (const item of items) {
            const lineId = Number(item.orderLineId);
            const quantity = Number(item.quantity);
            requested.set(lineId, (requested.get(lineId) || 0) + quantity);
        }

        const orderLines = this.db.prepare(`
            SELECT
                ol.id,
                ol.product_id,
                ol.quantity,
                ol.unit_price,
                COALESCE(ol.cost_at_time, p.cost) as product_cost,
                p.name as product_name,
                CASE WHEN EXISTS (
                    SELECT 1 FROM recipes r WHERE r.product_id = ol.product_id
                ) THEN 1 ELSE 0 END as has_recipe
            FROM order_lines ol
            JOIN products p ON p.id = ol.product_id
            WHERE ol.order_id = ?
        `).all(orderId) as PreparedOrderLine[];

        const returnedQuantities = this.db.prepare(`
            SELECT rl.order_line_id, SUM(rl.quantity) as returned_quantity
            FROM return_lines rl
            JOIN returns r ON r.id = rl.return_id
            WHERE r.original_order_id = ?
            GROUP BY rl.order_line_id
        `).all(orderId) as { order_line_id: number; returned_quantity: number }[];

        const returnedMap = new Map<number, number>();
        returnedQuantities.forEach(row => returnedMap.set(row.order_line_id, row.returned_quantity || 0));

        let totalRefund = 0;
        let totalCogs = 0;
        const lineItems: PreparedReturnLine[] = [];

        for (const [lineId, quantity] of requested.entries()) {
            const line = orderLines.find(orderLine => orderLine.id === lineId);
            if (!line) {
                throw new Error('Return line not found for order');
            }

            const alreadyReturned = returnedMap.get(line.id) || 0;
            const availableQty = line.quantity - alreadyReturned;
            if (quantity <= 0 || quantity > availableQty) {
                throw new Error(`Invalid return quantity for ${line.product_name}`);
            }

            const lineTotal = quantity * line.unit_price;
            const lineCogs = line.has_recipe ? 0 : (line.product_cost || 0) * quantity;
            totalRefund += lineTotal;
            totalCogs += lineCogs;
            lineItems.push({
                lineId: line.id,
                productId: line.product_id,
                quantity,
                unitPrice: line.unit_price,
                totalPrice: lineTotal,
                productCost: line.has_recipe ? 0 : (line.product_cost || 0),
                productName: line.product_name
            });
        }

        if (lineItems.length === 0) {
            throw new Error('Return must include at least one valid line');
        }

        return { orderLines, lineItems, totalRefund, totalCogs };
    }

    async createReturn(data: CreateReturnDTO, userId: number) {
        if (!data.reason || !data.reason.trim()) {
            throw new Error('Return reason is required');
        }
        if (!data.items || data.items.length === 0) {
            throw new Error('Return must include at least one line');
        }

        const order = this.db.prepare(`
            SELECT o.*, s.branch_id
            FROM orders o
            JOIN pos_sessions s ON s.id = o.session_id
            WHERE o.id = ?
        `).get(data.orderId) as any;
        if (!order) {
            throw new Error('Original order not found');
        }

        const previewReturn = this.prepareReturnLines(order.id, data.items);
        const { approvedBy } = await this.policyService.validateReturn({
            originalOrderId: data.orderId,
            returnTotal: previewReturn.totalRefund,
            reason: data.reason,
            sessionId: data.sessionId,
            isCashRefund: true,
            managerUsername: data.managerUsername,
            managerPassword: data.managerPassword,
            userId
        });

        const txn = this.db.transaction(() => {
            const preparedReturn = this.prepareReturnLines(order.id, data.items);
            const returnId = randomUUID();

            const insertReturn = this.db.prepare(`
                INSERT INTO returns (id, original_order_id, reason, total_refund, created_by)
                VALUES (?, ?, ?, ?, ?)
            `);

            const insertReturnLine = this.db.prepare(`
                INSERT INTO return_lines (return_id, order_line_id, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?)
            `);

            const inventorySettings = this.settingsService.getSettings('inventory') || {};
            const autoDeduct = inventorySettings.autoDeductStockOnSale !== false;

            insertReturn.run(returnId, order.id, data.reason, preparedReturn.totalRefund, userId);
            if (data.sessionId) {
                this.db.prepare(`
                    INSERT INTO payments (id, order_id, session_id, type, method, amount, status, notes, created_by)
                    VALUES (?, ?, ?, 'REFUND', 'CASH', ?, 'REFUNDED', ?, ?)
                `).run(randomUUID(), order.id, data.sessionId, preparedReturn.totalRefund, data.reason, userId);
            }

            for (const line of preparedReturn.lineItems) {
                insertReturnLine.run(returnId, line.lineId, line.quantity, line.unitPrice, line.totalPrice);
                if (autoDeduct) {
                    this.inventoryService.processReturn(
                        line.productId,
                        line.quantity,
                        returnId,
                        order.branch_id ?? null,
                        userId,
                        line.productCost
                    );
                }
            }

            const accounts = this.getAccountIds();
            const returnLines = [
                { account_id: accounts.salesId!, debit: preparedReturn.totalRefund, credit: 0, description: 'Return revenue reversal' },
                { account_id: accounts.cashId!, debit: 0, credit: preparedReturn.totalRefund, description: 'Cash refund' },
                ...(preparedReturn.totalCogs > 0 ? [
                    { account_id: accounts.inventoryId!, debit: preparedReturn.totalCogs, credit: 0, description: 'Inventory restored' },
                    { account_id: accounts.cogsId!, debit: 0, credit: preparedReturn.totalCogs, description: 'COGS reversal' }
                ] : [])
            ];
            const entry = this.accountingService.createJournalEntry({
                date: new Date().toISOString(),
                description: `POS Return ${order.order_number}`,
                source_type: 'POS_RETURNS',
                source_id: returnId,
                branch_id: order.branch_id ?? null,
                lines: returnLines
            });

            if (accounts.postingPolicy === 'IMMEDIATE') {
                this.accountingService.postEntry(entry.id!);
            }

            const updatedReturns = this.db.prepare(`
                SELECT rl.order_line_id, SUM(rl.quantity) as returned_quantity
                FROM return_lines rl
                JOIN returns r ON r.id = rl.return_id
                WHERE r.original_order_id = ?
                GROUP BY rl.order_line_id
            `).all(order.id) as { order_line_id: number; returned_quantity: number }[];

            const updatedMap = new Map<number, number>();
            updatedReturns.forEach(row => updatedMap.set(row.order_line_id, row.returned_quantity || 0));

            const fullyReturned = preparedReturn.orderLines.every(line => (updatedMap.get(line.id) || 0) >= line.quantity);
            if (fullyReturned) {
                this.db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('RETURNED', order.id);
            }

            return { returnId, totalRefund: preparedReturn.totalRefund };
        });

        return txn();
    }

    getProducts(search: string = '', page: number = 1, pageSize: number = 20, categoryId?: number) {
        const offset = (page - 1) * pageSize;
        const clauses: string[] = ['p.is_active = 1'];
        const params: any[] = [];

        if (categoryId) {
            clauses.push('p.category_id = ?');
            params.push(categoryId);
        }

        if (search && search.length >= 2) {
            const query = search.split(/\s+/).map(term => `${term}*`).join(' ');
            clauses.push('products_fts MATCH ?');
            params.push(query);

            const countRow = this.db.prepare(`
                SELECT COUNT(*) as count
                FROM products p
                JOIN products_fts fts ON p.id = fts.rowid
                WHERE ${clauses.join(' AND ')}
            `).get(...params) as { count: number };

            const items = this.db.prepare(`
                SELECT p.*
                FROM products p
                JOIN products_fts fts ON p.id = fts.rowid
                WHERE ${clauses.join(' AND ')}
                LIMIT ? OFFSET ?
            `).all(...params, pageSize, offset);

            return { items, total: countRow.count || 0, page, pageSize };
        }

        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM products p ${whereClause}`).get(...params) as { count: number };
        const items = this.db.prepare(`SELECT p.* FROM products p ${whereClause} ORDER BY p.name LIMIT ? OFFSET ?`)
            .all(...params, pageSize, offset);
        return { items, total: countRow.count || 0, page, pageSize };
    }

    private buildOrderPrintPayload(orderId: string) {
        const order = this.db.prepare(`
            SELECT o.*, s.branch_id, b.name as branch_name, u.username as cashier_name
            FROM orders o
            LEFT JOIN pos_sessions s ON s.id = o.session_id
            LEFT JOIN branches b ON b.id = s.branch_id
            LEFT JOIN users u ON u.id = o.collected_by
            WHERE o.id = ?
        `).get(orderId) as any;

        if (!order) return null;

        const lines = this.db.prepare(`
            SELECT ol.quantity, ol.unit_price, ol.total_price as total, ol.notes as line_note, p.name as product_name, p.category_id
            FROM order_lines ol
            JOIN products p ON p.id = ol.product_id
            WHERE ol.order_id = ?
            ORDER BY ol.id
        `).all(orderId) as any[];

        const notes = this.db.prepare(`
            SELECT n.content, n.created_at, u.username as created_by_name
            FROM order_notes n
            LEFT JOIN users u ON u.id = n.created_by
            WHERE n.order_id = ?
            ORDER BY n.created_at ASC, n.id ASC
        `).all(orderId) as any[];

        const itemsText = lines.map(line => {
            const price = (line.unit_price || 0).toFixed(0).padStart(6);
            let text = `${line.quantity} x ${line.product_name.padEnd(20)} ${price}`;
            if (line.line_note) {
                text += `\n  >> ${line.line_note}`;
            }
            return text;
        }).join('\n');

        const notesText = notes.map(n => n.content).join('\n');
        
        const settings = this.settingsService.getSettings('general') || {};
        const restaurantName = settings.restaurantName || 'DMS Restaurant';

        const paymentNotice = (order.order_type === 'DELIVERY' && order.payment_status === 'UNPAID')
            ? 'طلب ديلفري — غير مدفوع\nيتم التحصيل عند التسليم'
            : '';

        return {
            payload: {
                restaurant_name: restaurantName,
                branch_name: order.branch_name || '',
                order_id: order.id,
                order_number: order.order_number,
                created_at: new Date(order.created_at).toLocaleString(),
                cashier: order.cashier_name || 'Staff',
                table_number: order.table_number || 'N/A',
                order_type: order.order_type,
                payment_status: order.payment_status,
                delivery_status: order.delivery_status || '',
                delivery_phone: order.delivery_phone || '',
                delivery_address: order.delivery_address || '',
                items: itemsText,
                notes: notesText,
                subtotal: order.total_amount.toFixed(2),
                discount: '0.00',
                tax: '0.00',
                total: order.total_amount.toFixed(2),
                payment_notice: paymentNotice,
                footer_message: 'شكراً لزيارتكم'
            },
            branchId: order.branch_id ?? null,
            categoryIds: Array.from(new Set(lines.map(l => l.category_id).filter(Boolean))) as number[]
        };
    }

    printOrder(orderId: string, types: Array<'RECEIPT' | 'KOT'> = ['RECEIPT']) {
        const order = this.db.prepare(`
            SELECT o.id, s.branch_id
            FROM orders o
            LEFT JOIN pos_sessions s ON s.id = o.session_id
            WHERE o.id = ?
        `).get(orderId) as { id: string; branch_id?: number } | undefined;

        if (!order) throw new Error('Order not found');

        return this.queueOrderPrintJobs(orderId, order.branch_id ?? null, true, types);
    }

    processPrintQueue() {
        return this.printingService.processQueue();
    }

    getPrintJobs(jobIds: string[]) {
        return jobIds.map(id => this.printingService.getJobStatus(id)).filter(Boolean);
    }

    private queueOrderPrintJobs(orderId: string, branchId: number | null, failOnError = false, types: Array<'RECEIPT' | 'KOT'> = ['RECEIPT', 'KOT']) {
        const jobs: { id: string; type: string }[] = [];
        const data = this.buildOrderPrintPayload(orderId);
        if (!data) return jobs;

        const enqueue = () => {
            if (types.includes('KOT')) {
                const jobResult = this.printingService.enqueueJob({
                    type: 'KOT',
                    payload: data.payload,
                    branchId: data.branchId ?? branchId,
                    station: 'KITCHEN',
                    categoryIds: data.categoryIds
                });
                jobs.push({ id: jobResult.id, type: 'KOT' });
            }

            if (types.includes('RECEIPT')) {
                const jobResult = this.printingService.enqueueJob({
                    type: 'RECEIPT',
                    payload: data.payload,
                    branchId: data.branchId ?? branchId,
                    station: 'CASHIER'
                });
                jobs.push({ id: jobResult.id, type: 'RECEIPT' });
            }
        };

        if (failOnError) {
            enqueue();
        } else {
            try {
                enqueue();
            } catch (error) {
                console.warn('Failed to queue print jobs', error);
            }
        }

        return jobs;
    }

    private queueZReport(sessionId: string) {
        try {
            const session = this.db.prepare(`
                SELECT s.*, u.username as user_name, b.name as branch_name
                FROM pos_sessions s
                LEFT JOIN users u ON u.id = s.user_id
                LEFT JOIN branches b ON b.id = s.branch_id
                WHERE s.id = ?
            `).get(sessionId) as any;

            if (!session) return;

            const orders = this.db.prepare(`
                SELECT COUNT(*) as count, SUM(total_amount) as total
                FROM orders
                WHERE session_id = ?
            `).get(sessionId) as { count: number; total: number } | undefined;

            const payload = {
                session_id: session.id,
                start_time: session.start_time,
                end_time: session.end_time,
                orders_count: orders?.count || 0,
                total_sales: (orders?.total || 0).toFixed(2),
                closing_cash: (session.closing_cash || 0).toFixed(2),
                branch_name: session.branch_name || '',
                cashier: session.user_name || ''
            };

            this.printingService.enqueueJob({
                type: 'REPORT',
                payload,
                branchId: session.branch_id ?? null,
                reportName: 'Z_REPORT'
            });
        } catch (error) {
            console.warn('Failed to queue Z report', error);
        }
    }

    getOrder(orderId: string) {
        const order = this.db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
        if (!order) return null;

        const lines = this.db.prepare(`
            SELECT ol.id, ol.product_id, ol.quantity, ol.unit_price, ol.total_price as total, ol.notes, p.name as product_name
            FROM order_lines ol
            JOIN products p ON p.id = ol.product_id
            WHERE ol.order_id = ?
        `).all(orderId) as any[];

        const returned = this.db.prepare(`
            SELECT rl.order_line_id, SUM(rl.quantity) as returned_quantity
            FROM return_lines rl
            JOIN returns r ON r.id = rl.return_id
            WHERE r.original_order_id = ?
            GROUP BY rl.order_line_id
        `).all(orderId) as { order_line_id: number; returned_quantity: number }[];

        const returnedMap = new Map<number, number>();
        returned.forEach(row => returnedMap.set(row.order_line_id, row.returned_quantity || 0));

        const enrichedLines = lines.map(line => ({
            ...line,
            returned_quantity: returnedMap.get(line.id) || 0
        }));

        const notes = this.db.prepare('SELECT content, created_at FROM order_notes WHERE order_id = ? ORDER BY created_at ASC').all(orderId);

        return { ...order, lines: enrichedLines, notes };
    }

    listOrders(orderNumber?: string, page: number = 1, pageSize: number = 20, sessionId?: string) {
        const offset = (page - 1) * pageSize;

        if (orderNumber) {
            const order = this.db.prepare('SELECT * FROM orders WHERE order_number = ?').get(orderNumber) as any;
            if (!order) return { items: [], total: 0, page, pageSize };

            const lines = this.db.prepare(`
                SELECT ol.id, ol.product_id, ol.quantity, ol.unit_price, ol.total_price as total, p.name as product_name
                FROM order_lines ol
                JOIN products p ON p.id = ol.product_id
                WHERE ol.order_id = ?
            `).all(order.id) as any[];

            const returned = this.db.prepare(`
                SELECT rl.order_line_id, SUM(rl.quantity) as returned_quantity
                FROM return_lines rl
                JOIN returns r ON r.id = rl.return_id
                WHERE r.original_order_id = ?
                GROUP BY rl.order_line_id
            `).all(order.id) as { order_line_id: number; returned_quantity: number }[];

            const returnedMap = new Map<number, number>();
            returned.forEach(row => returnedMap.set(row.order_line_id, row.returned_quantity || 0));

            const enrichedLines = lines.map(line => ({
                ...line,
                returned_quantity: returnedMap.get(line.id) || 0
            }));

            return { items: [{ ...order, lines: enrichedLines }], total: 1, page, pageSize };
        }

        let whereClause = '';
        const params: any[] = [];

        if (sessionId) {
            whereClause = 'WHERE session_id = ?';
            params.push(sessionId);
        }

        const countRow = this.db.prepare(`SELECT COUNT(*) as count FROM orders ${whereClause}`).get(...params) as { count: number };
        const items = this.db.prepare(`
            SELECT id, order_number, status, total_amount, discount_amount, discount_type, 
                   order_type, payment_status, delivery_status, delivery_person_name, created_at 
            FROM orders 
            ${whereClause}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `).all(...params, pageSize, offset);

        return { items, total: countRow.count || 0, page, pageSize };
    }

    updateLineNote(orderId: string, lineId: number, note: string, userId: number) {
        // Validate order exists
        const order = this.db.prepare(`
            SELECT o.id, o.status, s.branch_id
            FROM orders o
            LEFT JOIN pos_sessions s ON s.id = o.session_id
            WHERE o.id = ?
        `).get(orderId) as { id: string; status: string; branch_id?: number } | undefined;

        if (!order) {
            throw new Error('Order not found');
        }

        // Validate line exists and belongs to order
        const line = this.db.prepare(`
            SELECT id FROM order_lines WHERE id = ? AND order_id = ?
        `).get(lineId, orderId) as { id: number } | undefined;

        if (!line) {
            throw new Error('Order line not found');
        }

        // Update the note
        this.db.prepare(`
            UPDATE order_lines SET notes = ? WHERE id = ?
        `).run(note || null, lineId);

        return { success: true, lineId, note };
    }

    getOrderLine(orderId: string, lineId: number) {
        return this.db.prepare(`
            SELECT ol.*, p.name as product_name
            FROM order_lines ol
            JOIN products p ON p.id = ol.product_id
            WHERE ol.id = ? AND ol.order_id = ?
        `).get(lineId, orderId);
    }

    listPendingDeliveryOrders(filters: { branchId?: number; sessionId?: string } = {}) {
        let sql = `
            SELECT o.id, o.order_number, o.created_at, o.total_amount as total,
                   o.payment_status, o.delivery_status,
                   COALESCE(o.delivery_courier_name, o.delivery_person_name) as delivery_person_name,
                   COALESCE(o.delivery_courier_phone, o.delivery_phone) as delivery_phone,
                   o.delivery_address,
                   o.delivery_courier_id,
                   (SELECT COUNT(*) FROM order_lines ol WHERE ol.order_id = o.id) as items_count
            FROM orders o
            LEFT JOIN pos_sessions s ON s.id = o.session_id
            WHERE o.status = 'PENDING_DELIVERY' AND o.payment_status = 'UNPAID'
        `;
        const params: (string | number)[] = [];

        if (filters.branchId) {
            sql += ' AND COALESCE(o.branch_id, s.branch_id) = ?';
            params.push(filters.branchId);
        }
        if (filters.sessionId) {
            sql += ' AND o.session_id = ?';
            params.push(filters.sessionId);
        }

        sql += ' ORDER BY o.created_at DESC';
        const items = this.db.prepare(sql).all(...params);
        return { items, total: items.length };
    }

    async collectDeliveryOrder(orderId: string, payload: { amount: number; paymentMethod?: string; notes?: string; sessionId?: string }, userId: number) {
        // 1. Policy Validation
        this.policyService.validateDeliveryCollection({ 
            orderId, 
            sessionId: payload.sessionId || '', 
            amount: payload.amount 
        });

        const order = this.db.prepare(`
            SELECT o.*, COALESCE(o.branch_id, s.branch_id) as effective_branch_id
            FROM orders o
            LEFT JOIN pos_sessions s ON s.id = o.session_id
            WHERE o.id = ?
        `).get(orderId) as any;
        if (!order) {
            throw new Error('Order not found.');
        }

        const paymentMethod = payload.paymentMethod || 'CASH';
        if (!['CASH', 'CARD', 'TRANSFER'].includes(paymentMethod)) {
            throw new Error('Unsupported payment method.');
        }

        const txn = this.db.transaction(() => {
            // 4. Update order status
            const updateInfo = this.db.prepare(`
                UPDATE orders
                SET status = 'COMPLETED', payment_status = 'PAID', delivery_status = 'DELIVERED', payment_method = ?,
                    collected_at = datetime('now'), collected_by = ?
                WHERE id = ?
                  AND status = 'PENDING_DELIVERY'
                  AND payment_status = 'UNPAID'
            `).run(paymentMethod, userId, orderId);

            if (updateInfo.changes === 0) {
                throw new Error('هذا الطلب تم تحصيله مسبقاً.');
            }

            // 5. Create payment record
            this.db.prepare(`
                INSERT INTO payments (id, order_id, session_id, type, method, amount, status, notes, created_by)
                VALUES (?, ?, ?, 'DELIVERY_COLLECTION', ?, ?, 'COMPLETED', ?, ?)
            `).run(randomUUID(), orderId, payload.sessionId || null, paymentMethod, payload.amount, payload.notes || null, userId);

            // 6. Create accounting entry
            const accounts = this.getAccountIds();
            const paymentAccountId = paymentMethod === 'CASH' ? accounts.cashId! : accounts.bankId!;
            const entry = this.accountingService.createJournalEntry({
                date: new Date().toISOString(),
                description: `Delivery Collection ${order.order_number}`,
                source_type: 'POS_DELIVERY_COLLECTION',
                source_id: orderId,
                branch_id: order.effective_branch_id ?? null,
                lines: [
                    { account_id: paymentAccountId, debit: payload.amount, credit: 0, description: paymentMethod === 'CASH' ? 'Delivery cash collected' : 'Delivery non-cash collected' },
                    { account_id: accounts.salesId!, debit: 0, credit: payload.amount, description: 'Delivery revenue recognized' }
                ]
            });
            if (accounts.postingPolicy === 'IMMEDIATE') {
                this.accountingService.postEntry(entry.id!);
            }

            return {
                success: true,
                orderId,
                orderNumber: order.order_number,
                collectedAmount: payload.amount,
                collectedAt: new Date().toISOString()
            };
        });

        const result = txn();

        this.policyService.writeAuditLog({
            userId,
            action: 'POS.DELIVERY_COLLECT',
            entityType: 'ORDER',
            entityId: orderId,
            newValue: { amount: payload.amount, paymentMethod: payload.paymentMethod || 'CASH', sessionId: payload.sessionId }
        });

        return result;
    }

    async voidOrder(data: { orderId: string, reason: string, managerUsername?: string, managerPassword?: string }, userId: number) {
        const order = this.db.prepare(`
            SELECT o.*, s.branch_id
            FROM orders o
            LEFT JOIN pos_sessions s ON s.id = o.session_id
            WHERE o.id = ?
        `).get(data.orderId) as any;
        if (!order) throw new Error('Order not found');

        const printed = this.db.prepare(`
            SELECT 1
            FROM print_jobs
            WHERE payload LIKE ?
            LIMIT 1
        `).get(`%"order_id":"${data.orderId}"%`);
        const isPrinted = Boolean(printed);

        const { approvedBy } = await this.policyService.validateVoid({
            orderId: data.orderId,
            isPaid: order.payment_status === 'PAID',
            isPrinted,
            reason: data.reason,
            managerUsername: data.managerUsername,
            managerPassword: data.managerPassword,
            userId
        });

        const txn = this.db.transaction(() => {
            const lines = this.db.prepare(`
                SELECT product_id, quantity, COALESCE(cost_at_time, 0) as cost_at_time
                FROM order_lines
                WHERE order_id = ?
            `).all(data.orderId) as Array<{ product_id: number; quantity: number; cost_at_time: number }>;

            this.db.prepare(`
                UPDATE orders 
                SET status = 'VOID',
                    payment_status = 'VOID',
                    delivery_commission_status = CASE 
                        WHEN delivery_commission_status = 'EARNED' THEN 'CANCELLED' 
                        ELSE delivery_commission_status 
                    END,
                    void_reason = ?,
                    voided_by = ?,
                    voided_at = datetime('now'),
                    void_approved_by = ?
                WHERE id = ?
            `).run(data.reason, userId, approvedBy || null, data.orderId);

            this.db.prepare("UPDATE payments SET status = 'VOID' WHERE order_id = ?").run(data.orderId);

            for (const line of lines) {
                this.inventoryService.processReturn(
                    line.product_id,
                    line.quantity,
                    `VOID-${data.orderId}`,
                    order.branch_id ?? null,
                    userId,
                    line.cost_at_time
                );
            }

            const entries = this.db.prepare(`
                SELECT id
                FROM journal_entries
                WHERE source_id = ? AND posted = 1
            `).all(data.orderId) as Array<{ id: string }>;
            for (const entry of entries) {
                this.accountingService.reverseEntry(entry.id, userId);
            }
        });

        txn();

        this.policyService.writeAuditLog({
            userId,
            action: 'POS.ORDER_VOID',
            entityType: 'ORDER',
            entityId: data.orderId,
            reason: data.reason,
            approvedBy
        });

        return { success: true };
    }

    async reprintReceipt(data: { orderId: string, managerUsername?: string, managerPassword?: string, reason?: string }, userId: number) {
        const order = this.db.prepare('SELECT reprint_count, session_id FROM orders WHERE id = ?').get(data.orderId) as any;
        if (!order) throw new Error('Order not found');

        const { approvedBy } = await this.policyService.validateReprint({
            orderId: data.orderId,
            reprintCount: order.reprint_count || 0,
            managerUsername: data.managerUsername,
            managerPassword: data.managerPassword,
            userId,
            reason: data.reason
        });

        this.db.prepare('UPDATE orders SET reprint_count = reprint_count + 1 WHERE id = ?').run(data.orderId);

        this.policyService.writeAuditLog({
            userId,
            action: 'POS.ORDER_REPRINT',
            entityType: 'ORDER',
            entityId: data.orderId,
            reason: data.reason,
            approvedBy
        });

        const session = this.db.prepare('SELECT branch_id FROM pos_sessions WHERE id = ?').get(order.session_id) as any;
        this.queueOrderPrintJobs(data.orderId, session?.branch_id || null, true, ['RECEIPT']);

        return { success: true };
    }

    listReturns(page: number = 1, pageSize: number = 20, sessionId?: string) {
        const offset = (page - 1) * pageSize;
        let whereClause = '';
        const params: any[] = [];

        if (sessionId) {
            whereClause = 'WHERE o.session_id = ?';
            params.push(sessionId);
        }

        const countRow = this.db.prepare(`
            SELECT COUNT(*) as count 
            FROM returns r
            LEFT JOIN orders o ON o.id = r.original_order_id
            ${whereClause}
        `).get(...params) as { count: number };

        const items = this.db.prepare(`
            SELECT r.id, r.original_order_id, r.reason, r.total_refund, r.created_at,
                   o.order_number, u.username as cashier_name
            FROM returns r
            LEFT JOIN orders o ON o.id = r.original_order_id
            LEFT JOIN users u ON u.id = r.created_by
            ${whereClause}
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, pageSize, offset);

        return { items, total: countRow.count || 0, page, pageSize };
    }
}

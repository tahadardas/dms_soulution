import { Database as DatabaseType } from 'better-sqlite3';
import { getDB } from '../database';
import { SettingsService } from './settingsService';
import { AuditService } from './audit';
import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '../config/permissions';

export class PolicyService {
    private db: DatabaseType;
    private settingsService: SettingsService;

    constructor(db?: DatabaseType) {
        this.db = db || getDB();
        this.settingsService = new SettingsService(this.db);
    }

    private getSettings() {
        return this.settingsService.getSettings('pos');
    }

    private getInventorySettings() {
        return this.settingsService.getSettings('inventory');
    }

    // --- Approvals & Audits ---
    
    async requireManagerApproval(
        managerUsername?: string,
        managerPassword?: string,
        action?: string,
        entityType?: string,
        entityId?: string,
        requestedBy?: number,
        reason?: string,
        requiredPermission?: string
    ) {
        if (!managerUsername || !managerPassword) {
            throw new Error('Manager approval is required for this action.');
        }

        const manager = this.db.prepare('SELECT * FROM users WHERE username = ?').get(managerUsername) as any;
        if (!manager) {
            throw new Error('بيانات المدير غير صحيحة.');
        }

        const isValid = await bcrypt.compare(managerPassword, manager.password_hash);
        if (!isValid) {
            throw new Error('بيانات المدير غير صحيحة.');
        }

        // Check if manager account is active (not deleted/disabled)
        if (manager.is_active !== undefined && manager.is_active !== null && Number(manager.is_active) === 0) {
            throw new Error('بيانات المدير غير صحيحة.');
        }

        // Prevent self-approval if policy disallows it
        const settings = this.getSettings();
        if (settings.preventSelfApproval !== false && requestedBy && manager.id === requestedBy) {
            throw new Error('لا يمكن للمستخدم الموافقة على عمليته الخاصة.');
        }

        // Strictly enforce permissions
        const rolePerms = this.db.prepare(
            'SELECT permission_code FROM role_permissions WHERE role_id = ?'
        ).all(manager.role_id) as { permission_code: string }[];
        const permCodes = new Set(rolePerms.map(p => p.permission_code));

        // Manager must have either ALL_ACCESS, MANAGER_APPROVAL, or the specific required permission
        const hasApprovalAuthority =
            permCodes.has('ALL_ACCESS') ||
            permCodes.has('MANAGER_APPROVAL') ||
            (requiredPermission ? permCodes.has(requiredPermission) : false);

        // Fallback: if no requiredPermission is passed, also accept legacy broad permissions
        const hasLegacyAuthority = !requiredPermission && (
            permCodes.has(PERMISSIONS.POS_VOID) ||
            permCodes.has(PERMISSIONS.POS_DISCOUNT) ||
            permCodes.has(PERMISSIONS.POS_CLOSE_SESSION) ||
            permCodes.has(PERMISSIONS.POS_RETURNS)
        );

        if (!hasApprovalAuthority && !hasLegacyAuthority) {
            throw new Error('هذا المستخدم لا يملك صلاحية الموافقة على هذه العملية.');
        }

        const insert = this.db.prepare(`
            INSERT INTO manager_approvals (action, entity_type, entity_id, requested_by, approved_by, reason)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = insert.run(action, entityType, entityId, requestedBy, manager.id, reason || null);

        // Write audit log for the approval
        this.writeAuditLog({
            userId: manager.id,
            action: `MANAGER_APPROVAL:${action || 'UNKNOWN'}`,
            entityType: entityType || 'UNKNOWN',
            entityId: entityId,
            reason: reason,
            approvedBy: manager.id
        });

        return { approvalId: result.lastInsertRowid, managerId: manager.id };
    }

    writeAuditLog(input: { userId: number, action: string, entityType: string, entityId?: string, oldValue?: any, newValue?: any, reason?: string, approvedBy?: number, ipAddress?: string, userAgent?: string }) {
        this.db.prepare(`
            INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_value, new_value, reason, approved_by, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            input.userId,
            input.action,
            input.entityType,
            input.entityId || null,
            input.oldValue ? JSON.stringify(input.oldValue) : null,
            input.newValue ? JSON.stringify(input.newValue) : null,
            input.reason || null,
            input.approvedBy || null,
            input.ipAddress || null,
            input.userAgent || null
        );
    }

    // --- Session Policies ---

    validateOpenSession(input: { userId: number, openingCash: number }) {
        const existingSession = this.db.prepare("SELECT id FROM pos_sessions WHERE user_id = ? AND status = 'OPEN'").get(input.userId);
        if (existingSession) {
            throw new Error('لا يمكن فتح جلسة جديدة. توجد جلسة مفتوحة بالفعل لهذا المستخدم.');
        }
        if (input.openingCash < 0) {
            throw new Error('مبلغ الافتتاح يجب أن يكون أكبر من أو يساوي الصفر.');
        }
    }

    calculateExpectedCash(sessionId: string) {
        const session = this.db.prepare('SELECT opening_cash FROM pos_sessions WHERE id = ?').get(sessionId) as { opening_cash: number } | undefined;
        if (!session) throw new Error('Session not found');

        // Cash sales
        const cashPayments = this.db.prepare(`
            SELECT SUM(amount) as total
            FROM payments p
            LEFT JOIN orders o ON o.id = p.order_id
            WHERE COALESCE(p.session_id, o.session_id) = ?
              AND p.method = 'CASH'
              AND p.status = 'COMPLETED'
        `).get(sessionId) as { total: number };

        // Delivery Cash Collections are essentially included in the cashPayments query if they were made in this session and method is CASH

        // Cash refunds
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

        const expectedCash = session.opening_cash
            + (cashPayments?.total || 0)
            + (cashIn?.total || 0)
            - (cashRefunds?.total || 0)
            - (cashOut?.total || 0);
        return expectedCash;
    }

    async validateCloseSession(input: { sessionId: string, actualCash: number, pendingDeliveryCount: number, managerUsername?: string, managerPassword?: string, reason?: string, userId: number }) {
        const settings = this.getSettings();
        
        if (input.actualCash == null || input.actualCash < 0) {
            throw new Error('يجب إدخال المبلغ الفعلي الموجود في الصندوق ويكون رقماً صحيحاً.');
        }

        const expectedCash = this.calculateExpectedCash(input.sessionId);
        const cashDifference = input.actualCash - expectedCash;
        const absCashDifference = Math.abs(cashDifference);

        let closeApprovedBy: number | undefined;

        if (absCashDifference > 0.001 && settings.requireReasonForCashDifference && !input.reason) {
            throw new Error('يجب إدخال سبب لفرق الصندوق.');
        }

        if (settings.cashDifferenceRequiresManager) {
            const managerThreshold = Number(settings.managerRequiredCashDifferenceAmount ?? settings.cashDifferenceToleranceAmount ?? 0);
            if (absCashDifference >= managerThreshold && managerThreshold > 0) {
                if (!input.managerUsername) {
                    throw new Error(`يوجد فرق صندوق بقيمة ${cashDifference}. يتطلب موافقة مدير.`);
                }
                const approval = await this.requireManagerApproval(input.managerUsername, input.managerPassword, 'CLOSE_SESSION_CASH_DIFF', 'POS_SESSION', input.sessionId, input.userId, input.reason, 'POS_SESSION_CLOSE_APPROVE');
                closeApprovedBy = approval.managerId;
            }
        }

        // Pending deliveries check
        if (input.pendingDeliveryCount > 0) {
            if (!settings.allowCloseSessionWithPendingDelivery) {
                if (!settings.pendingDeliveryCloseRequiresManager) {
                    throw new Error('لا يمكن إغلاق الجلسة، توجد طلبات توصيل معلقة غير محصلة.');
                }
                if (!closeApprovedBy) { // If not already approved
                    if (!input.managerUsername) {
                        throw new Error('يوجد طلبات توصيل معلقة. يتطلب موافقة مدير لإغلاق الجلسة.');
                    }
                    const approval = await this.requireManagerApproval(input.managerUsername, input.managerPassword, 'CLOSE_SESSION_PENDING_DELIVERY', 'POS_SESSION', input.sessionId, input.userId, input.reason, 'POS_SESSION_CLOSE_APPROVE');
                    closeApprovedBy = approval.managerId;
                }
            }
        }

        return { expectedCash, cashDifference, closeApprovedBy };
    }

    // --- Order & Delivery Policies ---

    validateOrderSave(input: { sessionId: string, itemsCount: number, orderType: string, isPaid: boolean, paymentsTotal: number, orderTotal: number }) {
        const session = this.db.prepare("SELECT id FROM pos_sessions WHERE id = ? AND status = 'OPEN'").get(input.sessionId);
        if (!session) {
            throw new Error('لا يمكن حفظ الطلب. يجب فتح جلسة صندوق أولاً.');
        }
        if (input.itemsCount === 0) {
            throw new Error('لا يمكن حفظ طلب فارغ.');
        }
        if (input.isPaid && Math.abs(input.paymentsTotal - input.orderTotal) > 0.01) {
            throw new Error('مجموع المدفوعات لا يساوي إجمالي الطلب.');
        }
    }

    validateDeliveryCollection(input: { orderId: string, sessionId: string, amount: number }) {
        const session = this.db.prepare("SELECT id FROM pos_sessions WHERE id = ? AND status = 'OPEN'").get(input.sessionId);
        if (!session) {
            throw new Error('لا يمكن تحصيل الطلب بدون جلسة صندوق مفتوحة.');
        }
        if (!Number.isFinite(input.amount) || input.amount <= 0) {
            throw new Error('مبلغ التحصيل يجب أن يكون أكبر من صفر.');
        }
        
        const order = this.db.prepare("SELECT payment_status, order_type, status, total_amount FROM orders WHERE id = ?").get(input.orderId) as any;
        if (!order) throw new Error('الطلب غير موجود.');
        
        if (order.order_type !== 'DELIVERY') {
            throw new Error('هذا الطلب ليس طلب توصيل.');
        }
        if (order.status === 'VOID' || order.status === 'RETURNED') {
            throw new Error('لا يمكن تحصيل طلب ملغى أو مرتجع.');
        }
        if (order.payment_status === 'PAID') {
            throw new Error('هذا الطلب تم تحصيله مسبقاً.');
        }
        if (order.status !== 'PENDING_DELIVERY' || order.payment_status !== 'UNPAID') {
            throw new Error('لا يمكن تحصيل طلب ديلفري غير معلق.');
        }

        const paid = this.db.prepare(`
            SELECT COALESCE(SUM(amount), 0) as total
            FROM payments
            WHERE order_id = ?
              AND status = 'COMPLETED'
              AND type IN ('PAYMENT', 'DELIVERY_COLLECTION')
        `).get(input.orderId) as { total: number };

        const remainingAmount = Number(order.total_amount || 0) - Number(paid?.total || 0);
        const tolerance = 0.001;

        if (remainingAmount <= tolerance) {
            throw new Error('هذا الطلب تم تحصيله مسبقاً.');
        }
        if (input.amount < remainingAmount - tolerance) {
            throw new Error('المبلغ المحصل أقل من المبلغ المطلوب.');
        }
        if (input.amount > remainingAmount + tolerance) {
            throw new Error('المبلغ المحصل أكبر من المبلغ المطلوب.');
        }
    }

    // --- Returns & Voids Policies ---

    async validateReturn(input: { originalOrderId: string, returnTotal: number, reason?: string, sessionId?: string, isCashRefund: boolean, managerUsername?: string, managerPassword?: string, userId: number }) {
        const settings = this.getSettings();

        const order = this.db.prepare("SELECT status, total_amount FROM orders WHERE id = ?").get(input.originalOrderId) as any;
        if (!order) throw new Error('الطلب الأصلي غير موجود.');
        if (order.status === 'VOID') throw new Error('لا يمكن إرجاع طلب ملغى.');
        
        if (settings.requireReasonForReturn && !input.reason) {
            throw new Error('سبب الإرجاع إلزامي.');
        }

        let approvedBy: number | undefined;
        if (settings.managerRequiredReturnAmount > 0 && input.returnTotal >= settings.managerRequiredReturnAmount) {
            if (!input.managerUsername) throw new Error(`إرجاع مبلغ ${input.returnTotal} يتطلب موافقة مدير.`);
            const approval = await this.requireManagerApproval(input.managerUsername, input.managerPassword, 'RETURN_ORDER', 'ORDER', input.originalOrderId, input.userId, input.reason, 'POS_RETURN_APPROVE');
            approvedBy = approval.managerId;
        }

        if (input.isCashRefund) {
            if (!input.sessionId) throw new Error('الاسترداد النقدي يتطلب جلسة صندوق مفتوحة.');
            const session = this.db.prepare("SELECT id FROM pos_sessions WHERE id = ? AND status = 'OPEN'").get(input.sessionId);
            if (!session) throw new Error('جلسة الصندوق مغلقة.');
        }

        return { approvedBy };
    }

    async validateVoid(input: { orderId: string, isPaid: boolean, isPrinted: boolean, reason?: string, managerUsername?: string, managerPassword?: string, userId: number }) {
        const settings = this.getSettings();
        const order = this.db.prepare("SELECT status FROM orders WHERE id = ?").get(input.orderId) as any;
        if (!order) throw new Error('الطلب غير موجود.');
        if (order.status === 'VOID') throw new Error('الطلب ملغى مسبقاً.');

        if (settings.requireReasonForVoid && !input.reason) {
            throw new Error('سبب الإلغاء إلزامي.');
        }

        let approvedBy: number | undefined;
        if ((input.isPaid && settings.managerRequiredVoidAfterPayment) || input.isPrinted) {
            if (!input.managerUsername) throw new Error('إلغاء هذا الطلب يتطلب موافقة مدير.');
            const approval = await this.requireManagerApproval(input.managerUsername, input.managerPassword, 'VOID_ORDER', 'ORDER', input.orderId, input.userId, input.reason, 'POS_ORDER_VOID_APPROVE');
            approvedBy = approval.managerId;
        }

        return { approvedBy };
    }

    // --- Discount Policy ---

    async validateDiscount(input: { discountPercent: number, discountAmount: number, totalAmount: number, managerUsername?: string, managerPassword?: string, userId: number, reason?: string }) {
        const settings = this.getSettings();
        
        if (input.discountAmount < 0 || input.discountPercent < 0) {
            throw new Error('الخصم يجب أن يكون قيمة موجبة.');
        }
        if (input.discountAmount > input.totalAmount) {
            throw new Error('الخصم لا يمكن أن يتجاوز إجمالي الطلب.');
        }

        let approvedBy: number | undefined;
        let requiresManager = false;

        if (settings.maxCashierDiscountPercent > 0 && input.discountPercent > settings.maxCashierDiscountPercent) requiresManager = true;
        if (settings.maxCashierDiscountAmount > 0 && input.discountAmount > settings.maxCashierDiscountAmount) requiresManager = true;

        if (requiresManager) {
            if (!input.managerUsername) throw new Error('قيمة الخصم تتجاوز صلاحياتك وتتطلب موافقة مدير.');
            const approval = await this.requireManagerApproval(input.managerUsername, input.managerPassword, 'APPLY_DISCOUNT', 'ORDER', undefined, input.userId, input.reason, 'POS_DISCOUNT_APPROVE');
            approvedBy = approval.managerId;
        }

        return { approvedBy };
    }

    // --- Reprint Policy ---

    async validateReprint(input: { orderId: string, reprintCount: number, managerUsername?: string, managerPassword?: string, userId: number, reason?: string }) {
        const settings = this.getSettings();
        
        let approvedBy: number | undefined;
        if (input.reprintCount > 0 && settings.managerRequiredReprint) {
            if (!input.managerUsername) throw new Error('إعادة طباعة هذا الإيصال تتطلب موافقة مدير.');
            const approval = await this.requireManagerApproval(input.managerUsername, input.managerPassword, 'REPRINT_RECEIPT', 'ORDER', input.orderId, input.userId, input.reason, 'POS_REPRINT_APPROVE');
            approvedBy = approval.managerId;
        }

        return { approvedBy };
    }

    // --- Inventory & Accounting ---

    validateInventoryAvailability(items: { productId: number, quantity: number }[], branchId?: number | null) {
        const invSettings = this.getInventorySettings();
        if (invSettings.allowNegativeStock) return;

        for (const item of items) {
            const recipe = this.db.prepare('SELECT 1 FROM recipes WHERE product_id = ? LIMIT 1').get(item.productId);
            if (recipe) {
                continue;
            }

            const stock = branchId
                ? this.db.prepare('SELECT quantity_on_hand as quantity FROM inventory_stock WHERE branch_id = ? AND product_id = ?')
                    .get(branchId, item.productId) as { quantity: number } | undefined
                : this.db.prepare('SELECT COALESCE(SUM(quantity_on_hand), 0) as quantity FROM inventory_stock WHERE product_id = ?')
                    .get(item.productId) as { quantity: number } | undefined;

            if (!stock || stock.quantity < item.quantity) {
                const prod = this.db.prepare('SELECT name FROM products WHERE id = ?').get(item.productId) as { name: string };
                throw new Error(`الرصيد غير كافٍ للمنتج "${prod?.name || item.productId}". الكمية المتوفرة: ${stock?.quantity || 0}`);
            }
        }
    }

    validateJournalEntry(input: { lines: { debit: number, credit: number }[], date: string }) {
        let totalDebit = 0;
        let totalCredit = 0;
        
        if (input.lines.length < 2) {
            throw new Error('يجب أن يحتوي القيد على سطرين على الأقل.');
        }

        for (const line of input.lines) {
            if (line.debit < 0 || line.credit < 0) throw new Error('لا يمكن أن يحتوي القيد مبالغ سالبة.');
            if (line.debit > 0 && line.credit > 0) throw new Error('لا يمكن أن يحتوي السطر الواحد على مبلغ مدين ودائن معاً.');
            totalDebit += line.debit;
            totalCredit += line.credit;
        }

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error('القيد غير متوازن.');
        }

        // Future check: check if period is closed based on input.date
    }
}

import { Database as DatabaseType } from 'better-sqlite3';
import crypto from 'crypto';
import { InventoryService } from './inventoryService';
import { AccountingService } from './accountingService';
import { TABLES } from '../db/schema';
import { DocumentService, DocumentStatus, DocumentTypeCode } from './documentService';

export interface InvoiceLine {
    product_id: number;
    quantity: number;
    unit_price: number;
    tax_amount?: number;
    discount_amount?: number;
    discount_rate?: number;
    landed_cost_amount?: number;
}

export interface PurchaseInvoiceInput {
    supplier_id: number;
    branch_id: number;
    invoice_number: string;
    date: string;
    lines: InvoiceLine[];
    notes?: string;
    discount_amount?: number;
    landed_cost_amount?: number;
}

export interface SalesInvoiceInput {
    customer_id: number;
    branch_id: number;
    invoice_number: string;
    date: string;
    lines: (InvoiceLine & { cost_at_time?: number })[];
    notes?: string;
    discount_amount?: number;
}

export class InvoiceService {
    private db: DatabaseType;
    private inventoryService: InventoryService;
    private accountingService: AccountingService;
    private documentService: DocumentService;

    constructor(db: DatabaseType) {
        this.db = db;
        this.inventoryService = new InventoryService(db);
        this.accountingService = new AccountingService(db);
        this.documentService = new DocumentService(db);
    }

    private requirePositiveAmount(value: number, fieldName: string): number {
        if (!Number.isFinite(value) || value <= 0) {
            throw new Error(`${fieldName} must be greater than zero`);
        }
        return value;
    }

    private requireNonNegativeAmount(value: number, fieldName: string): number {
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`${fieldName} cannot be negative`);
        }
        return value;
    }

    private calculateLineNet(line: InvoiceLine) {
        const quantity = this.requirePositiveAmount(Number(line.quantity), 'quantity');
        const unitPrice = this.requireNonNegativeAmount(Number(line.unit_price), 'unit_price');
        const gross = quantity * unitPrice;
        const discountRate = this.requireNonNegativeAmount(Number(line.discount_rate || 0), 'discount_rate');
        if (discountRate > 100) throw new Error('discount_rate cannot exceed 100');
        const discountAmount = line.discount_amount !== undefined
            ? this.requireNonNegativeAmount(Number(line.discount_amount), 'discount_amount')
            : gross * (discountRate / 100);
        if (discountAmount > gross) throw new Error('Line discount cannot exceed line gross amount');
        const taxAmount = this.requireNonNegativeAmount(Number(line.tax_amount || 0), 'tax_amount');
        const landedCostAmount = this.requireNonNegativeAmount(Number(line.landed_cost_amount || 0), 'landed_cost_amount');
        return {
            quantity,
            unitPrice,
            gross,
            discountRate,
            discountAmount,
            net: gross - discountAmount,
            taxAmount,
            landedCostAmount
        };
    }

    private assertNoPartyDuplicate(tableName: 'customers' | 'suppliers', data: { name: string; phone?: string; tax_number?: string }) {
        const name = String(data.name || '').trim();
        if (!name) throw new Error('Name is required');
        const checks: Array<{ field: string; value?: string }> = [
            { field: 'tax_number', value: data.tax_number },
            { field: 'phone', value: data.phone },
            { field: 'name', value: name }
        ];
        for (const check of checks) {
            const value = String(check.value || '').trim();
            if (!value) continue;
            const existing = this.db.prepare(`SELECT id FROM ${tableName} WHERE ${check.field} = ? LIMIT 1`).get(value);
            if (existing) {
                throw new Error(`${tableName.slice(0, -1)} already exists with the same ${check.field}`);
            }
        }
    }

    private assertOpeningBalanceIsNotRaw(openingBalance?: number) {
        const amount = Number(openingBalance || 0);
        if (Math.abs(amount) > 0.001) {
            throw new Error('Opening balance must be recorded through an opening journal entry, not as a raw party balance.');
        }
    }

    private syncInvoiceDocument(input: {
        documentTypeCode: Extract<DocumentTypeCode, 'PURCHASE_INVOICE' | 'SALES_INVOICE'>;
        sourceTable: 'purchase_invoices' | 'sales_invoices';
        id: string;
        invoiceNumber: string;
        status: DocumentStatus;
        branchId: number;
        totalBeforeDiscount?: number;
        totalAmount: number;
        taxAmount?: number;
        discountAmount?: number;
        currencyCode?: string | null;
        exchangeRate?: number | null;
        journalEntryId?: string | null;
        postedBy?: number | null;
        postedAt?: string | null;
        reversedBy?: number | null;
        reversedAt?: string | null;
        reversalReason?: string | null;
        createdBy?: number | null;
    }): void {
        const taxAmount = Number(input.taxAmount || 0);
        const discountAmount = Number(input.discountAmount || 0);
        this.documentService.upsertDocument({
            documentTypeCode: input.documentTypeCode,
            sourceTable: input.sourceTable,
            sourceId: input.id,
            documentNumber: input.invoiceNumber,
            status: input.status,
            branchId: input.branchId,
            currencyCode: input.currencyCode || 'SYP',
            exchangeRate: input.exchangeRate || 1,
            totalBeforeDiscount: input.totalBeforeDiscount ?? Number(input.totalAmount || 0) + discountAmount,
            discountAmount,
            taxAmount,
            totalAmount: Number(input.totalAmount || 0) + taxAmount,
            journalEntryId: input.journalEntryId ?? null,
            postedBy: input.postedBy ?? null,
            postedAt: input.postedAt ?? null,
            reversedBy: input.reversedBy ?? null,
            reversedAt: input.reversedAt ?? null,
            reversalReason: input.reversalReason ?? null,
            createdBy: input.createdBy ?? null
        });
    }

    private syncPaymentDocument(input: {
        documentTypeCode: Extract<DocumentTypeCode, 'CUSTOMER_RECEIPT' | 'SUPPLIER_PAYMENT'>;
        sourceTable: 'customer_receipts' | 'supplier_payments';
        id: string;
        branchId: number;
        amount: number;
        journalEntryId: string;
        createdBy?: number | null;
    }): void {
        this.documentService.upsertDocument({
            documentTypeCode: input.documentTypeCode,
            sourceTable: input.sourceTable,
            sourceId: input.id,
            status: 'POSTED',
            branchId: input.branchId,
            currencyCode: 'SYP',
            exchangeRate: 1,
            totalBeforeDiscount: input.amount,
            totalAmount: input.amount,
            journalEntryId: input.journalEntryId,
            postedBy: input.createdBy ?? null,
            postedAt: new Date().toISOString(),
            createdBy: input.createdBy ?? null
        });
    }

    private calculateStoredLineDiscountTotal(lines: Array<{ discount_amount?: number | null }> = []): number {
        return lines.reduce((sum, line) => sum + Number(line.discount_amount || 0), 0);
    }

    // --- Suppliers ---

    createSupplier(data: { 
        name: string; 
        phone?: string; 
        email?: string; 
        address?: string; 
        tax_number?: string;
        currency_code?: string;
        payment_terms_days?: number;
        opening_balance?: number;
    }) {
        this.assertOpeningBalanceIsNotRaw(data.opening_balance);
        this.assertNoPartyDuplicate('suppliers', data);
        return this.db.transaction(() => {
            const stmt = this.db.prepare(`
                INSERT INTO suppliers (name, phone, email, address, tax_number, currency_code, payment_terms_days, opening_balance)
                VALUES (@name, @phone, @email, @address, @tax_number, @currency_code, @payment_terms_days, @opening_balance)
            `);
            const info = stmt.run({
                name: data.name,
                phone: data.phone ?? null,
                email: data.email ?? null,
                address: data.address ?? null,
                tax_number: data.tax_number ?? null,
                currency_code: data.currency_code || 'SYP',
                payment_terms_days: data.payment_terms_days || 0,
                opening_balance: data.opening_balance || 0
            });
            const supplierId = info.lastInsertRowid;

            // Generate Accounting Accounts
            const apControl = this.getAccountBySystemRole('AP_CONTROL');
            const advControl = this.db.prepare("SELECT id FROM accounts WHERE code = '1160'").get() as { id: number } | undefined;

            if (!apControl || !advControl) {
                throw new Error('Accounting control accounts (AP_CONTROL or 1160) not found');
            }

            // AP Account
            const lastAp = this.db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '2110.%' ORDER BY code DESC LIMIT 1").get(apControl.id) as { code: string } | undefined;
            let nextApCode = '2110.0001';
            if (lastAp) {
                const parts = lastAp.code.split('.');
                if (parts.length > 1) {
                    const num = parseInt(parts[1]) + 1;
                    nextApCode = `2110.${num.toString().padStart(4, '0')}`;
                }
            }

            const apId = this.db.prepare(`
                INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                VALUES (?, ?, 'LIABILITY', ?, 'SUPPLIER', ?, 1)
            `).run(nextApCode, `ذمم دائنة - ${data.name}`, apControl.id, supplierId).lastInsertRowid;

            // Advances Account
            const lastAdv = this.db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '1160.%' ORDER BY code DESC LIMIT 1").get(advControl.id) as { code: string } | undefined;
            let nextAdvCode = '1160.0001';
            if (lastAdv) {
                const parts = lastAdv.code.split('.');
                if (parts.length > 1) {
                    const num = parseInt(parts[1]) + 1;
                    nextAdvCode = `1160.${num.toString().padStart(4, '0')}`;
                }
            }

            const advId = this.db.prepare(`
                INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                VALUES (?, ?, 'ASSET', ?, 'SUPPLIER', ?, 1)
            `).run(nextAdvCode, `دفعات مقدمة للمورد - ${data.name}`, advControl.id, supplierId).lastInsertRowid;

            // Update supplier with account IDs
            this.db.prepare('UPDATE suppliers SET payable_account_id = ?, advance_account_id = ? WHERE id = ?')
                .run(apId, advId, supplierId);

            return { 
                ...data, 
                id: supplierId,
                payable_account_id: apId,
                advance_account_id: advId,
                payable_account_code: nextApCode,
                advance_account_code: nextAdvCode
            };
        })();
    }

    updateSupplier(id: number, data: {
        name?: string;
        phone?: string;
        email?: string;
        address?: string;
        tax_number?: string;
        is_active?: number;
        currency_code?: string;
    }) {
        const sets: string[] = [];
        const params: any = { id };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                sets.push(`${key} = @${key}`);
                params[key] = value;
            }
        });

        if (sets.length === 0) return;

        this.db.prepare(`
            UPDATE suppliers SET ${sets.join(', ')} WHERE id = @id
        `).run(params);

        // If name updated, update account names too
        if (data.name) {
            this.db.prepare(`
                UPDATE accounts SET name = ? WHERE party_type = 'SUPPLIER' AND party_id = ? AND code LIKE '2110.%'
            `).run(`ذمم دائنة - ${data.name}`, id);
            this.db.prepare(`
                UPDATE accounts SET name = ? WHERE party_type = 'SUPPLIER' AND party_id = ? AND code LIKE '1160.%'
            `).run(`دفعات مقدمة - ${data.name}`, id);
        }
    }

    listSuppliers() {
        return this.db.prepare(`
            SELECT s.*, a.code as payable_account_code, a.name as payable_account_name 
            FROM suppliers s
            LEFT JOIN accounts a ON s.payable_account_id = a.id
            ORDER BY s.name ASC
        `).all();
    }

    getSupplier(id: number) {
        return this.db.prepare(`
            SELECT s.*, a.code as payable_account_code, a.name as payable_account_name 
            FROM suppliers s
            LEFT JOIN accounts a ON s.payable_account_id = a.id
            WHERE s.id = ?
        `).get(id) as any;
    }

    recordSupplierPayment(data: {
        supplier_id: number;
        branch_id: number;
        account_id: number; // Source (Cash/Bank)
        amount: number;
        date: string;
        payment_method: string;
        reference_number?: string;
        notes?: string;
    }, userId?: number) {
        return this.db.transaction(() => {
            const supplier = this.db.prepare('SELECT name, payable_account_id FROM suppliers WHERE id = ?').get(data.supplier_id) as { name: string, payable_account_id: number } | undefined;
            if (!supplier) throw new Error('Supplier not found');
            if (!supplier.payable_account_id) throw new Error('Supplier does not have a linked payable account');

            const paymentId = crypto.randomUUID();

            // 1. Create Journal Entry
            const journal = this.accountingService.createJournalEntry({
                date: data.date,
                description: `Payment to Supplier: ${supplier.name} (${data.payment_method})${data.reference_number ? ` Ref: ${data.reference_number}` : ''}`,
                source_type: 'SUPPLIER_PAYMENT',
                source_id: paymentId,
                branch_id: data.branch_id,
                lines: [
                    {
                        account_id: supplier.payable_account_id,
                        debit: data.amount,
                        credit: 0,
                        description: `Payment to ${supplier.name}`
                    },
                    {
                        account_id: data.account_id,
                        debit: 0,
                        credit: data.amount,
                        description: `Payment to ${supplier.name}`
                    }
                ]
            });

            this.accountingService.postEntry(journal.id!, userId);

            // 2. Insert Payment Record
            this.db.prepare(`
                INSERT INTO supplier_payments (id, supplier_id, branch_id, account_id, amount, date, reference_number, payment_method, notes, journal_entry_id, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                paymentId,
                data.supplier_id,
                data.branch_id,
                data.account_id,
                data.amount,
                data.date,
                data.reference_number || null,
                data.payment_method,
                data.notes || null,
                journal.id,
                userId ?? null
            );

            this.syncPaymentDocument({
                documentTypeCode: 'SUPPLIER_PAYMENT',
                sourceTable: 'supplier_payments',
                id: paymentId,
                branchId: data.branch_id,
                amount: data.amount,
                journalEntryId: journal.id!,
                createdBy: userId ?? null
            });

            return { success: true, payment_id: paymentId, journal_entry_id: journal.id };
        })();
    }

    listCustomers() {
        return this.db.prepare(`
            SELECT c.*, a.code as receivable_account_code, a.name as receivable_account_name 
            FROM customers c
            LEFT JOIN accounts a ON c.receivable_account_id = a.id
            ORDER BY c.name ASC
        `).all();
    }

    getCustomer(id: number) {
        return this.db.prepare(`
            SELECT c.*, a.code as receivable_account_code, a.name as receivable_account_name 
            FROM customers c
            LEFT JOIN accounts a ON c.receivable_account_id = a.id
            WHERE c.id = ?
        `).get(id) as any;
    }

    createCustomer(data: { 
        name: string; 
        phone?: string; 
        email?: string; 
        address?: string; 
        tax_number?: string;
        currency_code?: string;
        opening_balance?: number;
    }) {
        this.assertOpeningBalanceIsNotRaw(data.opening_balance);
        this.assertNoPartyDuplicate('customers', data);
        return this.db.transaction(() => {
            const stmt = this.db.prepare(`
                INSERT INTO customers (name, phone, email, address, tax_number, currency_code, opening_balance)
                VALUES (@name, @phone, @email, @address, @tax_number, @currency_code, @opening_balance)
            `);
            const info = stmt.run({
                name: data.name,
                phone: data.phone ?? null,
                email: data.email ?? null,
                address: data.address ?? null,
                tax_number: data.tax_number ?? null,
                currency_code: data.currency_code || 'SYP',
                opening_balance: data.opening_balance || 0
            });
            const customerId = info.lastInsertRowid;

            // Generate Accounting Accounts
            const arControl = this.getAccountBySystemRole('AR_CONTROL');
            const advControl = this.db.prepare("SELECT id FROM accounts WHERE code = '2130'").get() as { id: number } | undefined;

            if (!arControl || !advControl) {
                throw new Error('Accounting control accounts (AR_CONTROL or 2130) not found');
            }

            // AR Account
            const lastAr = this.db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '1110.%' ORDER BY code DESC LIMIT 1").get(arControl.id) as { code: string } | undefined;
            let nextArCode = '1110.0001';
            if (lastAr) {
                const parts = lastAr.code.split('.');
                if (parts.length > 1) {
                    const num = parseInt(parts[1]) + 1;
                    nextArCode = `1110.${num.toString().padStart(4, '0')}`;
                }
            }

            const arId = this.db.prepare(`
                INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                VALUES (?, ?, 'ASSET', ?, 'CUSTOMER', ?, 1)
            `).run(nextArCode, `ذمم مدينة - ${data.name}`, arControl.id, customerId).lastInsertRowid;

            // Advances Account
            const lastAdv = this.db.prepare("SELECT code FROM accounts WHERE parent_id = ? AND code LIKE '2130.%' ORDER BY code DESC LIMIT 1").get(advControl.id) as { code: string } | undefined;
            let nextAdvCode = '2130.0001';
            if (lastAdv) {
                const parts = lastAdv.code.split('.');
                if (parts.length > 1) {
                    const num = parseInt(parts[1]) + 1;
                    nextAdvCode = `2130.${num.toString().padStart(4, '0')}`;
                }
            }

            const advId = this.db.prepare(`
                INSERT INTO accounts (code, name, type, parent_id, party_type, party_id, is_system)
                VALUES (?, ?, 'LIABILITY', ?, 'CUSTOMER', ?, 1)
            `).run(nextAdvCode, `دفعات مقدمة من الزبون - ${data.name}`, advControl.id, customerId).lastInsertRowid;

            this.db.prepare('UPDATE customers SET receivable_account_id = ?, advance_account_id = ? WHERE id = ?')
                .run(arId, advId, customerId);

            return { id: customerId, receivable_account_id: arId, advance_account_id: advId };
        })();
    }

    updateCustomer(id: number, data: any) {
        const sets: string[] = [];
        const params: any = { id };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined) {
                sets.push(`${key} = @${key}`);
                params[key] = value;
            }
        });

        if (sets.length === 0) return;

        this.db.prepare(`UPDATE customers SET ${sets.join(', ')} WHERE id = @id`).run(params);

        if (data.name) {
            this.db.prepare(`UPDATE accounts SET name = ? WHERE party_type = 'CUSTOMER' AND party_id = ? AND code LIKE '1110.%'`).run(`ذمم مدينة - ${data.name}`, id);
            this.db.prepare(`UPDATE accounts SET name = ? WHERE party_type = 'CUSTOMER' AND party_id = ? AND code LIKE '2130.%'`).run(`دفعات مقدمة من الزبون - ${data.name}`, id);
        }
    }

    recordCustomerReceipt(data: {
        customer_id: number;
        branch_id: number;
        account_id: number; // Destination (Cash/Bank)
        amount: number;
        date: string;
        payment_method: string;
        reference_number?: string;
        notes?: string;
    }, userId?: number) {
        return this.db.transaction(() => {
            const customer = this.db.prepare('SELECT name, receivable_account_id FROM customers WHERE id = ?').get(data.customer_id) as { name: string, receivable_account_id: number } | undefined;
            if (!customer) throw new Error('Customer not found');
            if (!customer.receivable_account_id) throw new Error('Customer does not have a linked receivable account');

            const receiptId = crypto.randomUUID();

            const journal = this.accountingService.createJournalEntry({
                date: data.date,
                description: `Receipt from Customer: ${customer.name} (${data.payment_method})${data.reference_number ? ` Ref: ${data.reference_number}` : ''}`,
                source_type: 'CUSTOMER_RECEIPT',
                source_id: receiptId,
                branch_id: data.branch_id,
                lines: [
                    {
                        account_id: data.account_id,
                        debit: data.amount,
                        credit: 0,
                        description: `Receipt from ${customer.name}`
                    },
                    {
                        account_id: customer.receivable_account_id,
                        debit: 0,
                        credit: data.amount,
                        description: `Receipt from ${customer.name}`
                    }
                ]
            });

            this.accountingService.postEntry(journal.id!, userId);

            this.db.prepare(`
                INSERT INTO customer_receipts (id, customer_id, branch_id, account_id, amount, date, reference_number, payment_method, notes, journal_entry_id, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                receiptId,
                data.customer_id,
                data.branch_id,
                data.account_id,
                data.amount,
                data.date,
                data.reference_number || null,
                data.payment_method,
                data.notes || null,
                journal.id,
                userId ?? null
            );

            this.syncPaymentDocument({
                documentTypeCode: 'CUSTOMER_RECEIPT',
                sourceTable: 'customer_receipts',
                id: receiptId,
                branchId: data.branch_id,
                amount: data.amount,
                journalEntryId: journal.id!,
                createdBy: userId ?? null
            });

            return { success: true, receipt_id: receiptId, journal_entry_id: journal.id };
        })();
    }

    // --- Purchase Invoices ---

    createPurchaseInvoice(input: PurchaseInvoiceInput, userId: number) {
        return this.db.transaction(() => {
            // Check for unique invoice number per supplier
            const existing = this.db.prepare('SELECT id FROM purchase_invoices WHERE supplier_id = ? AND invoice_number = ?').get(input.supplier_id, input.invoice_number);
            if (existing) throw new Error(`Invoice number ${input.invoice_number} already exists for this supplier`);

            const id = crypto.randomUUID();
            if (!input.lines || input.lines.length === 0) throw new Error('Invoice must have at least one line');
            const lineAmounts = input.lines.map(line => this.calculateLineNet(line));
            const lineGrossTotal = lineAmounts.reduce((sum, line) => sum + line.gross, 0);
            const lineDiscountTotal = lineAmounts.reduce((sum, line) => sum + line.discountAmount, 0);
            const lineNetTotal = lineAmounts.reduce((sum, line) => sum + line.net, 0);
            const invoiceDiscount = this.requireNonNegativeAmount(Number(input.discount_amount || 0), 'discount_amount');
            if (invoiceDiscount > lineNetTotal) throw new Error('Invoice discount cannot exceed invoice subtotal');
            const totalAmount = lineNetTotal - invoiceDiscount;
            const totalTax = lineAmounts.reduce((sum, line) => sum + line.taxAmount, 0);
            const landedCostAmount = this.requireNonNegativeAmount(
                Number(input.landed_cost_amount ?? lineAmounts.reduce((sum, line) => sum + line.landedCostAmount, 0)),
                'landed_cost_amount'
            );

            this.db.prepare(`
                INSERT INTO purchase_invoices (
                    id, supplier_id, branch_id, invoice_number, date, status,
                    total_amount, tax_amount, discount_amount, landed_cost_amount, notes, created_by
                )
                VALUES (
                    @id, @supplier_id, @branch_id, @invoice_number, @date, 'DRAFT',
                    @total_amount, @tax_amount, @discount_amount, @landed_cost_amount, @notes, @created_by
                )
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                tax_amount: totalTax,
                discount_amount: invoiceDiscount,
                landed_cost_amount: landedCostAmount,
                notes: input.notes ?? null,
                created_by: userId
            });

            const lineStmt = this.db.prepare(`
                INSERT INTO purchase_invoice_lines (
                    invoice_id, product_id, quantity, unit_price, total_price, tax_amount,
                    discount_amount, discount_rate, landed_cost_amount
                )
                VALUES (
                    @invoice_id, @product_id, @quantity, @unit_price, @total_price, @tax_amount,
                    @discount_amount, @discount_rate, @landed_cost_amount
                )
            `);

            for (const [index, line] of input.lines.entries()) {
                const amounts = lineAmounts[index];
                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: amounts.quantity,
                    unit_price: amounts.unitPrice,
                    total_price: amounts.net,
                    tax_amount: amounts.taxAmount,
                    discount_amount: amounts.discountAmount,
                    discount_rate: amounts.discountRate,
                    landed_cost_amount: amounts.landedCostAmount
                });
            }

            this.syncInvoiceDocument({
                documentTypeCode: 'PURCHASE_INVOICE',
                sourceTable: 'purchase_invoices',
                id,
                invoiceNumber: input.invoice_number,
                status: 'DRAFT',
                branchId: input.branch_id,
                totalBeforeDiscount: lineGrossTotal,
                totalAmount,
                taxAmount: totalTax,
                discountAmount: lineDiscountTotal + invoiceDiscount,
                createdBy: userId
            });

            return this.getPurchaseInvoice(id);
        })();
    }

    updatePurchaseInvoice(id: string, input: PurchaseInvoiceInput) {
        return this.db.transaction(() => {
            const current = this.getPurchaseInvoice(id);
            if (!current) throw new Error('Invoice not found');
            if (current.status !== 'DRAFT') throw new Error('Only draft invoices can be updated');

            if (!input.lines || input.lines.length === 0) throw new Error('Invoice must have at least one line');
            const lineAmounts = input.lines.map(line => this.calculateLineNet(line));
            const lineGrossTotal = lineAmounts.reduce((sum, line) => sum + line.gross, 0);
            const lineDiscountTotal = lineAmounts.reduce((sum, line) => sum + line.discountAmount, 0);
            const lineNetTotal = lineAmounts.reduce((sum, line) => sum + line.net, 0);
            const invoiceDiscount = this.requireNonNegativeAmount(Number(input.discount_amount || 0), 'discount_amount');
            if (invoiceDiscount > lineNetTotal) throw new Error('Invoice discount cannot exceed invoice subtotal');
            const totalAmount = lineNetTotal - invoiceDiscount;
            const totalTax = lineAmounts.reduce((sum, line) => sum + line.taxAmount, 0);
            const landedCostAmount = this.requireNonNegativeAmount(
                Number(input.landed_cost_amount ?? lineAmounts.reduce((sum, line) => sum + line.landedCostAmount, 0)),
                'landed_cost_amount'
            );

            this.db.prepare(`
                UPDATE purchase_invoices 
                SET supplier_id = @supplier_id, branch_id = @branch_id, invoice_number = @invoice_number, 
                    date = @date, total_amount = @total_amount, tax_amount = @total_tax,
                    discount_amount = @discount_amount, landed_cost_amount = @landed_cost_amount, notes = @notes
                WHERE id = @id
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                total_tax: totalTax,
                discount_amount: invoiceDiscount,
                landed_cost_amount: landedCostAmount,
                notes: input.notes ?? null
            });

            this.db.prepare('DELETE FROM purchase_invoice_lines WHERE invoice_id = ?').run(id);

            const lineStmt = this.db.prepare(`
                INSERT INTO purchase_invoice_lines (
                    invoice_id, product_id, quantity, unit_price, total_price, tax_amount,
                    discount_amount, discount_rate, landed_cost_amount
                )
                VALUES (
                    @invoice_id, @product_id, @quantity, @unit_price, @total_price, @tax_amount,
                    @discount_amount, @discount_rate, @landed_cost_amount
                )
            `);

            for (const [index, line] of input.lines.entries()) {
                const amounts = lineAmounts[index];
                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: amounts.quantity,
                    unit_price: amounts.unitPrice,
                    total_price: amounts.net,
                    tax_amount: amounts.taxAmount,
                    discount_amount: amounts.discountAmount,
                    discount_rate: amounts.discountRate,
                    landed_cost_amount: amounts.landedCostAmount
                });
            }

            this.syncInvoiceDocument({
                documentTypeCode: 'PURCHASE_INVOICE',
                sourceTable: 'purchase_invoices',
                id,
                invoiceNumber: input.invoice_number,
                status: 'DRAFT',
                branchId: input.branch_id,
                totalBeforeDiscount: lineGrossTotal,
                totalAmount,
                taxAmount: totalTax,
                discountAmount: lineDiscountTotal + invoiceDiscount
            });

            return this.getPurchaseInvoice(id);
        })();
    }

    getPurchaseInvoice(id: string) {
        const invoice = this.db.prepare('SELECT * FROM purchase_invoices WHERE id = ?').get(id) as any;
        if (!invoice) return null;
        const lines = this.db.prepare('SELECT * FROM purchase_invoice_lines WHERE invoice_id = ?').all(id);
        return { ...invoice, lines };
    }

    postPurchaseInvoice(id: string, userId: number) {
        return this.db.transaction(() => {
            const invoice = this.getPurchaseInvoice(id);
            if (!invoice) throw new Error('Invoice not found');
            if (invoice.status !== 'DRAFT') throw new Error('Only draft invoices can be posted');
            if (invoice.journal_entry_id) throw new Error('Invoice is already linked to a posted journal entry');

            // --- Strict Validation ---
            if (!invoice.lines || invoice.lines.length === 0) throw new Error('Invoice must have at least one line');
            
            const supplier = this.db.prepare('SELECT * FROM suppliers WHERE id = ?').get(invoice.supplier_id) as any;
            if (!supplier) throw new Error('Supplier not found');
            if (!supplier.payable_account_id) throw new Error('Supplier does not have a linked payable account');

            const branch = this.db.prepare('SELECT id FROM branches WHERE id = ?').get(invoice.branch_id);
            if (!branch) throw new Error('Branch not found');

            if (!invoice.invoice_number) throw new Error('Invoice number is required');

            // 1. Update Inventory
            for (const line of invoice.lines) {
                if (line.product_id <= 0) throw new Error(`Invalid product ID: ${line.product_id}`);
                if (line.quantity <= 0) throw new Error(`Invalid quantity for product ${line.product_id}`);
                if (line.unit_price < 0) throw new Error(`Invalid unit price for product ${line.product_id}`);
                if (line.tax_amount < 0) throw new Error(`Invalid tax amount for product ${line.product_id}`);

                this.inventoryService.stockIn({
                    branchId: invoice.branch_id,
                    productId: line.product_id,
                    quantity: line.quantity,
                    unitCost: (line.total_price + (line.landed_cost_amount || 0)) / line.quantity,
                    type: 'PURCHASE',
                    referenceId: invoice.id,
                    sourceType: 'PURCHASE_INVOICE',
                    description: `Purchase Invoice ${invoice.invoice_number}`,
                    date: invoice.date,
                    createdBy: userId
                });
            }

            // 2. Accounting Entry
            // Debit: Inventory (SYSTEM_ROLE: INVENTORY)
            // Debit: VAT Input (SYSTEM_ROLE: VAT_INPUT)
            // Credit: Supplier Payable (supplier.payable_account_id)
            const inventoryAccount = this.getAccountBySystemRole('INVENTORY');
            const vatInputAccount = this.getAccountBySystemRole('VAT_INPUT');

            if (!inventoryAccount) throw new Error('Inventory account (SYSTEM_ROLE: INVENTORY) not found');

            const inventoryValue = invoice.total_amount + (invoice.landed_cost_amount || 0);
            const journalLines = [
                { 
                    account_id: inventoryAccount.id, 
                    debit: inventoryValue, 
                    credit: 0, 
                    description: `Inventory Increase - Inv ${invoice.invoice_number}` 
                },
                { 
                    account_id: supplier.payable_account_id, 
                    debit: 0, 
                    credit: inventoryValue + (invoice.tax_amount || 0), 
                    description: `Payable to ${supplier.name} - Inv ${invoice.invoice_number}` 
                }
            ];

            if (invoice.tax_amount > 0) {
                if (!vatInputAccount) throw new Error('VAT Input account (SYSTEM_ROLE: VAT_INPUT) not found');
                journalLines.push({
                    account_id: vatInputAccount.id,
                    debit: invoice.tax_amount,
                    credit: 0,
                    description: `VAT Input - Inv ${invoice.invoice_number}`
                });
            }

            const journal = this.accountingService.createJournalEntry({
                date: invoice.date,
                description: `Purchase Invoice ${invoice.invoice_number} - Supplier ${supplier.name}`,
                source_type: 'PURCHASE_INVOICE',
                source_id: invoice.id,
                branch_id: invoice.branch_id,
                lines: journalLines
            });

            this.accountingService.postEntry(journal.id!, userId);

            // 3. Update Invoice Status
            this.db.prepare(`
                UPDATE purchase_invoices
                SET status = 'POSTED',
                    journal_entry_id = ?,
                    posted_by = ?,
                    posted_at = datetime('now')
                WHERE id = ?
            `).run(journal.id, userId, id);

            this.syncInvoiceDocument({
                documentTypeCode: 'PURCHASE_INVOICE',
                sourceTable: 'purchase_invoices',
                id: invoice.id,
                invoiceNumber: invoice.invoice_number,
                status: 'DRAFT',
                branchId: invoice.branch_id,
                totalBeforeDiscount: Number(invoice.total_amount || 0)
                    + Number(invoice.discount_amount || 0)
                    + this.calculateStoredLineDiscountTotal(invoice.lines || []),
                totalAmount: invoice.total_amount,
                taxAmount: invoice.tax_amount,
                discountAmount: Number(invoice.discount_amount || 0) + this.calculateStoredLineDiscountTotal(invoice.lines || []),
                journalEntryId: journal.id,
                createdBy: invoice.created_by
            });
            this.documentService.markPosted({
                documentTypeCode: 'PURCHASE_INVOICE',
                sourceId: invoice.id,
                journalEntryId: journal.id!,
                postedBy: userId
            });

            return { success: true, journal_entry_id: journal.id };
        })();
    }

    // --- Sales Invoices ---

    createSalesInvoice(input: SalesInvoiceInput, userId: number) {
        return this.db.transaction(() => {
            // Check for unique invoice number per customer
            const existing = this.db.prepare('SELECT id FROM sales_invoices WHERE customer_id = ? AND invoice_number = ?').get(input.customer_id, input.invoice_number);
            if (existing) throw new Error(`Invoice number ${input.invoice_number} already exists for this customer`);

            const id = crypto.randomUUID();
            if (!input.lines || input.lines.length === 0) throw new Error('Invoice must have at least one line');
            const lineAmounts = input.lines.map(line => this.calculateLineNet(line));
            const lineGrossTotal = lineAmounts.reduce((sum, line) => sum + line.gross, 0);
            const lineDiscountTotal = lineAmounts.reduce((sum, line) => sum + line.discountAmount, 0);
            const lineNetTotal = lineAmounts.reduce((sum, line) => sum + line.net, 0);
            const invoiceDiscount = this.requireNonNegativeAmount(Number(input.discount_amount || 0), 'discount_amount');
            if (invoiceDiscount > lineNetTotal) throw new Error('Invoice discount cannot exceed invoice subtotal');
            const totalAmount = lineNetTotal - invoiceDiscount;
            const totalTax = lineAmounts.reduce((sum, line) => sum + line.taxAmount, 0);

            this.db.prepare(`
                INSERT INTO sales_invoices (
                    id, customer_id, branch_id, invoice_number, date, status,
                    total_amount, tax_amount, discount_amount, payment_status, notes, created_by
                )
                VALUES (
                    @id, @customer_id, @branch_id, @invoice_number, @date, 'DRAFT',
                    @total_amount, @tax_amount, @discount_amount, 'UNPAID', @notes, @created_by
                )
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                tax_amount: totalTax,
                discount_amount: invoiceDiscount,
                notes: input.notes ?? null,
                created_by: userId
            });

            const lineStmt = this.db.prepare(`
                INSERT INTO sales_invoice_lines (
                    invoice_id, product_id, quantity, unit_price, cost_at_time,
                    total_price, tax_amount, discount_amount, discount_rate
                )
                VALUES (
                    @invoice_id, @product_id, @quantity, @unit_price, @cost_at_time,
                    @total_price, @tax_amount, @discount_amount, @discount_rate
                )
            `);

            for (const [index, line] of input.lines.entries()) {
                const amounts = lineAmounts[index];
                // Get current cost if not provided
                let cost = line.cost_at_time;
                if (cost === undefined) {
                    const stock = this.inventoryService.getStockLevel({ branchId: input.branch_id, productId: line.product_id });
                    cost = stock.averageCost;
                }

                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: amounts.quantity,
                    unit_price: amounts.unitPrice,
                    cost_at_time: cost,
                    total_price: amounts.net,
                    tax_amount: amounts.taxAmount,
                    discount_amount: amounts.discountAmount,
                    discount_rate: amounts.discountRate
                });
            }

            this.syncInvoiceDocument({
                documentTypeCode: 'SALES_INVOICE',
                sourceTable: 'sales_invoices',
                id,
                invoiceNumber: input.invoice_number,
                status: 'DRAFT',
                branchId: input.branch_id,
                totalBeforeDiscount: lineGrossTotal,
                totalAmount,
                taxAmount: totalTax,
                discountAmount: lineDiscountTotal + invoiceDiscount,
                createdBy: userId
            });

            return this.getSalesInvoice(id);
        })();
    }

    updateSalesInvoice(id: string, input: SalesInvoiceInput) {
        return this.db.transaction(() => {
            const current = this.getSalesInvoice(id);
            if (!current) throw new Error('Invoice not found');
            if (current.status !== 'DRAFT') throw new Error('Only draft invoices can be updated');

            if (!input.lines || input.lines.length === 0) throw new Error('Invoice must have at least one line');
            const lineAmounts = input.lines.map(line => this.calculateLineNet(line));
            const lineGrossTotal = lineAmounts.reduce((sum, line) => sum + line.gross, 0);
            const lineDiscountTotal = lineAmounts.reduce((sum, line) => sum + line.discountAmount, 0);
            const lineNetTotal = lineAmounts.reduce((sum, line) => sum + line.net, 0);
            const invoiceDiscount = this.requireNonNegativeAmount(Number(input.discount_amount || 0), 'discount_amount');
            if (invoiceDiscount > lineNetTotal) throw new Error('Invoice discount cannot exceed invoice subtotal');
            const totalAmount = lineNetTotal - invoiceDiscount;
            const totalTax = lineAmounts.reduce((sum, line) => sum + line.taxAmount, 0);

            this.db.prepare(`
                UPDATE sales_invoices 
                SET customer_id = @customer_id, branch_id = @branch_id, invoice_number = @invoice_number, 
                    date = @date, total_amount = @total_amount, tax_amount = @total_tax,
                    discount_amount = @discount_amount, notes = @notes
                WHERE id = @id
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                total_tax: totalTax,
                discount_amount: invoiceDiscount,
                notes: input.notes ?? null
            });

            this.db.prepare('DELETE FROM sales_invoice_lines WHERE invoice_id = ?').run(id);

            const lineStmt = this.db.prepare(`
                INSERT INTO sales_invoice_lines (
                    invoice_id, product_id, quantity, unit_price, cost_at_time,
                    total_price, tax_amount, discount_amount, discount_rate
                )
                VALUES (
                    @invoice_id, @product_id, @quantity, @unit_price, @cost_at_time,
                    @total_price, @tax_amount, @discount_amount, @discount_rate
                )
            `);

            for (const [index, line] of input.lines.entries()) {
                const amounts = lineAmounts[index];
                let cost = line.cost_at_time;
                if (cost === undefined) {
                    const stock = this.inventoryService.getStockLevel({ branchId: input.branch_id, productId: line.product_id });
                    cost = stock.averageCost;
                }
                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: amounts.quantity,
                    unit_price: amounts.unitPrice,
                    cost_at_time: cost,
                    total_price: amounts.net,
                    tax_amount: amounts.taxAmount,
                    discount_amount: amounts.discountAmount,
                    discount_rate: amounts.discountRate
                });
            }

            this.syncInvoiceDocument({
                documentTypeCode: 'SALES_INVOICE',
                sourceTable: 'sales_invoices',
                id,
                invoiceNumber: input.invoice_number,
                status: 'DRAFT',
                branchId: input.branch_id,
                totalBeforeDiscount: lineGrossTotal,
                totalAmount,
                taxAmount: totalTax,
                discountAmount: lineDiscountTotal + invoiceDiscount
            });

            return this.getSalesInvoice(id);
        })();
    }

    getSalesInvoice(id: string) {
        const invoice = this.db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(id) as any;
        if (!invoice) return null;
        const lines = this.db.prepare('SELECT * FROM sales_invoice_lines WHERE invoice_id = ?').all(id);
        return { ...invoice, lines };
    }

    postSalesInvoice(id: string, userId: number) {
        return this.db.transaction(() => {
            const invoice = this.getSalesInvoice(id);
            if (!invoice) throw new Error('Invoice not found');
            if (invoice.status !== 'DRAFT') throw new Error('Only draft invoices can be posted');
            if (invoice.journal_entry_id) throw new Error('Invoice is already linked to a posted journal entry');

            // --- Strict Validation ---
            if (!invoice.lines || invoice.lines.length === 0) throw new Error('Invoice must have at least one line');
            
            const customer = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(invoice.customer_id) as any;
            if (!customer) throw new Error('Customer not found');

            const branch = this.db.prepare('SELECT id FROM branches WHERE id = ?').get(invoice.branch_id);
            if (!branch) throw new Error('Branch not found');

            if (!invoice.invoice_number) throw new Error('Invoice number is required');

            // 1. Update Inventory and calculate actual COGS
            let totalActualCost = 0;
            for (const line of invoice.lines) {
                if (line.product_id <= 0) throw new Error(`Invalid product ID: ${line.product_id}`);
                if (line.quantity <= 0) throw new Error(`Invalid quantity for product ${line.product_id}`);
                if (line.unit_price < 0) throw new Error(`Invalid unit price for product ${line.product_id}`);
                if (line.tax_amount < 0) throw new Error(`Invalid tax amount for product ${line.product_id}`);

                const stockOutResult = this.inventoryService.stockOut({
                    branchId: invoice.branch_id,
                    productId: line.product_id,
                    quantity: line.quantity,
                    type: 'SALE',
                    referenceId: invoice.id,
                    sourceType: 'SALES_INVOICE',
                    description: `Sales Invoice ${invoice.invoice_number}`,
                    date: invoice.date,
                    createdBy: userId
                });
                
                totalActualCost += stockOutResult.issuedCost;

                // Update line with actual cost if different (for reporting)
                this.db.prepare('UPDATE sales_invoice_lines SET cost_at_time = ? WHERE id = ?')
                    .run(stockOutResult.unitCost, line.id);
            }

            // 2. Accounting Entry
            // Dr Accounts Receivable (1100)
            // Cr Sales Revenue (SYSTEM_ROLE: SALES_REVENUE)
            // Cr VAT Output (SYSTEM_ROLE: VAT_OUTPUT)
            // Dr COGS (SYSTEM_ROLE: COGS)
            // Cr Inventory (SYSTEM_ROLE: INVENTORY)
            
            const salesAccount = this.getAccountBySystemRole('SALES_REVENUE');
            const vatOutputAccount = this.getAccountBySystemRole('VAT_OUTPUT');
            const cogsAccount = this.getAccountBySystemRole('COGS');
            const inventoryAccount = this.getAccountBySystemRole('INVENTORY');

            if (!customer.receivable_account_id) {
                throw new Error('Customer does not have a linked receivable account');
            }

            if (!salesAccount || !cogsAccount || !inventoryAccount) {
                throw new Error('Required accounting roles (Sales, COGS, or Inventory) not found');
            }

            const journalLines = [
                { 
                    account_id: customer.receivable_account_id, 
                    debit: invoice.total_amount + (invoice.tax_amount || 0), 
                    credit: 0, 
                    description: `Receivable from ${customer.name} - Inv ${invoice.invoice_number}` 
                },
                { 
                    account_id: salesAccount.id, 
                    debit: 0, 
                    credit: invoice.total_amount, 
                    description: `Sales Revenue - Inv ${invoice.invoice_number}` 
                },
                { 
                    account_id: cogsAccount.id, 
                    debit: totalActualCost, 
                    credit: 0, 
                    description: `COGS - Inv ${invoice.invoice_number}` 
                },
                { 
                    account_id: inventoryAccount.id, 
                    debit: 0, 
                    credit: totalActualCost, 
                    description: `Inventory Decrease - Inv ${invoice.invoice_number}` 
                }
            ];

            if (invoice.tax_amount > 0) {
                if (!vatOutputAccount) throw new Error('VAT Output account (SYSTEM_ROLE: VAT_OUTPUT) not found');
                journalLines.push({
                    account_id: vatOutputAccount.id,
                    debit: 0,
                    credit: invoice.tax_amount,
                    description: `VAT Output - Inv ${invoice.invoice_number}`
                });
            }

            const journal = this.accountingService.createJournalEntry({
                date: invoice.date,
                description: `Sales Invoice ${invoice.invoice_number} - Customer ${customer.name}`,
                source_type: 'SALES_INVOICE',
                source_id: invoice.id,
                branch_id: invoice.branch_id,
                lines: journalLines
            });

            this.accountingService.postEntry(journal.id!, userId);

            // 3. Update Invoice Status
            this.db.prepare(`
                UPDATE sales_invoices
                SET status = 'POSTED',
                    journal_entry_id = ?,
                    posted_by = ?,
                    posted_at = datetime('now')
                WHERE id = ?
            `).run(journal.id, userId, id);

            this.syncInvoiceDocument({
                documentTypeCode: 'SALES_INVOICE',
                sourceTable: 'sales_invoices',
                id: invoice.id,
                invoiceNumber: invoice.invoice_number,
                status: 'DRAFT',
                branchId: invoice.branch_id,
                totalBeforeDiscount: Number(invoice.total_amount || 0)
                    + Number(invoice.discount_amount || 0)
                    + this.calculateStoredLineDiscountTotal(invoice.lines || []),
                totalAmount: invoice.total_amount,
                taxAmount: invoice.tax_amount,
                discountAmount: Number(invoice.discount_amount || 0) + this.calculateStoredLineDiscountTotal(invoice.lines || []),
                journalEntryId: journal.id,
                createdBy: invoice.created_by
            });
            this.documentService.markPosted({
                documentTypeCode: 'SALES_INVOICE',
                sourceId: invoice.id,
                journalEntryId: journal.id!,
                postedBy: userId
            });

            return { success: true, journal_entry_id: journal.id };
        })();
    }

    recordSalesInvoicePayment(id: string, data: {
        account_id: number;
        amount: number;
        date: string;
        payment_method: string;
        reference_number?: string;
        notes?: string;
    }, userId?: number) {
        return this.db.transaction(() => {
            const invoice = this.getSalesInvoice(id);
            if (!invoice) throw new Error('Invoice not found');
            if (invoice.status !== 'POSTED') throw new Error('Only posted invoices can receive payments');
            const amount = this.requirePositiveAmount(Number(data.amount), 'amount');
            const invoiceTotal = Number(invoice.total_amount || 0) + Number(invoice.tax_amount || 0);
            const paidAmount = Number(invoice.paid_amount || 0);
            if (paidAmount + amount > invoiceTotal + 0.001) {
                throw new Error('Payment exceeds invoice outstanding amount');
            }
            const receipt = this.recordCustomerReceipt({
                customer_id: invoice.customer_id,
                branch_id: invoice.branch_id,
                account_id: data.account_id,
                amount,
                date: data.date,
                payment_method: data.payment_method,
                reference_number: data.reference_number || id,
                notes: data.notes || `Payment for sales invoice ${invoice.invoice_number}`
            }, userId);
            const nextPaid = paidAmount + amount;
            const nextStatus = nextPaid >= invoiceTotal - 0.001 ? 'PAID' : 'PARTIAL';
            this.db.prepare(`
                UPDATE sales_invoices
                SET paid_amount = ?,
                    payment_status = ?
                WHERE id = ?
            `).run(nextPaid, nextStatus, id);
            this.documentService.linkDocuments({
                sourceDocumentType: 'CUSTOMER_RECEIPT',
                sourceDocumentId: receipt.receipt_id,
                linkedDocumentType: 'SALES_INVOICE',
                linkedDocumentId: id,
                linkType: 'PAYMENT_FOR',
                createdBy: userId ?? null,
                metadata: { allocated_amount: amount }
            });
            return { ...receipt, paid_amount: nextPaid, payment_status: nextStatus };
        })();
    }

    reversePostedPurchaseInvoice(id: string, userId?: number, reversalReason = 'Purchase invoice reversal') {
        return this.db.transaction(() => {
            const invoice = this.getPurchaseInvoice(id);
            if (!invoice) throw new Error('Invoice not found');
            if (invoice.status !== 'POSTED' || !invoice.journal_entry_id) {
                throw new Error('Only posted purchase invoices can be reversed');
            }
            for (const line of invoice.lines || []) {
                this.inventoryService.stockOut({
                    branchId: invoice.branch_id,
                    productId: line.product_id,
                    quantity: line.quantity,
                    type: 'OUT',
                    referenceId: `PURCHASE_RETURN-${invoice.id}`,
                    sourceType: 'PURCHASE_RETURN',
                    description: `Purchase return ${invoice.invoice_number}`,
                    date: new Date().toISOString(),
                    createdBy: userId ?? null
                });
            }
            const reversal = this.accountingService.reverseEntry(invoice.journal_entry_id, userId);
            this.db.prepare(`
                UPDATE purchase_invoices
                SET status = 'CANCELLED',
                    reversed_by = ?,
                    reversed_at = datetime('now'),
                    reversal_reason = ?
                WHERE id = ?
            `).run(userId ?? null, reversalReason, id);
            this.documentService.markReversed({
                documentTypeCode: 'PURCHASE_INVOICE',
                sourceId: id,
                reversedBy: userId ?? null,
                reversalReason
            });
            this.documentService.upsertDocument({
                documentTypeCode: 'PURCHASE_RETURN',
                sourceTable: null,
                sourceId: `PURCHASE_RETURN-${invoice.id}`,
                documentNumber: `RETURN-${invoice.invoice_number}`,
                status: 'POSTED',
                branchId: invoice.branch_id,
                totalBeforeDiscount: invoice.total_amount + Number(invoice.discount_amount || 0),
                discountAmount: invoice.discount_amount || 0,
                taxAmount: invoice.tax_amount || 0,
                totalAmount: invoice.total_amount + Number(invoice.tax_amount || 0),
                journalEntryId: reversal.id,
                postedBy: userId ?? null,
                postedAt: new Date().toISOString(),
                createdBy: userId ?? null
            });
            this.documentService.linkDocuments({
                sourceDocumentType: 'PURCHASE_RETURN',
                sourceDocumentId: `PURCHASE_RETURN-${invoice.id}`,
                linkedDocumentType: 'PURCHASE_INVOICE',
                linkedDocumentId: id,
                linkType: 'REVERSAL_OF',
                createdBy: userId ?? null
            });
            return { success: true, reversal_journal_entry_id: reversal.id };
        })();
    }

    reversePostedSalesInvoice(id: string, userId?: number, reversalReason = 'Sales invoice reversal') {
        return this.db.transaction(() => {
            const invoice = this.getSalesInvoice(id);
            if (!invoice) throw new Error('Invoice not found');
            if (invoice.status !== 'POSTED' || !invoice.journal_entry_id) {
                throw new Error('Only posted sales invoices can be reversed');
            }
            for (const line of invoice.lines || []) {
                this.inventoryService.returnStock({
                    branchId: invoice.branch_id,
                    productId: line.product_id,
                    quantity: line.quantity,
                    unitCost: line.cost_at_time,
                    referenceId: `SALES_RETURN-${invoice.id}`,
                    sourceType: 'SALES_RETURN',
                    description: `Sales return ${invoice.invoice_number}`,
                    date: new Date().toISOString(),
                    createdBy: userId ?? null
                });
            }
            const reversal = this.accountingService.reverseEntry(invoice.journal_entry_id, userId);
            this.db.prepare(`
                UPDATE sales_invoices
                SET status = 'CANCELLED',
                    reversed_by = ?,
                    reversed_at = datetime('now'),
                    reversal_reason = ?
                WHERE id = ?
            `).run(userId ?? null, reversalReason, id);
            this.documentService.markReversed({
                documentTypeCode: 'SALES_INVOICE',
                sourceId: id,
                reversedBy: userId ?? null,
                reversalReason
            });
            this.documentService.upsertDocument({
                documentTypeCode: 'SALES_RETURN',
                sourceTable: 'returns',
                sourceId: `SALES_RETURN-${invoice.id}`,
                documentNumber: `RETURN-${invoice.invoice_number}`,
                status: 'POSTED',
                branchId: invoice.branch_id,
                totalBeforeDiscount: invoice.total_amount + Number(invoice.discount_amount || 0),
                discountAmount: invoice.discount_amount || 0,
                taxAmount: invoice.tax_amount || 0,
                totalAmount: invoice.total_amount + Number(invoice.tax_amount || 0),
                journalEntryId: reversal.id,
                postedBy: userId ?? null,
                postedAt: new Date().toISOString(),
                createdBy: userId ?? null
            });
            this.documentService.linkDocuments({
                sourceDocumentType: 'SALES_RETURN',
                sourceDocumentId: `SALES_RETURN-${invoice.id}`,
                linkedDocumentType: 'SALES_INVOICE',
                linkedDocumentId: id,
                linkType: 'REVERSAL_OF',
                createdBy: userId ?? null
            });
            return { success: true, reversal_journal_entry_id: reversal.id };
        })();
    }

    getCustomerStatement(customerId: number, filters: { startDate?: string; endDate?: string } = {}) {
        const customer = this.getCustomer(customerId);
        if (!customer?.receivable_account_id) throw new Error('Customer does not have a linked receivable account');
        return this.getPartyStatement({
            accountId: customer.receivable_account_id,
            party: customer,
            startDate: filters.startDate,
            endDate: filters.endDate,
            normalSide: 'DEBIT',
            invoiceTypes: ['SALES_INVOICE', 'POS_SALES'],
            paymentTypes: ['CUSTOMER_RECEIPT', 'POS_DELIVERY_COLLECTION'],
            returnTypes: ['SALES_RETURN', 'POS_RETURNS']
        });
    }

    getSupplierStatement(supplierId: number, filters: { startDate?: string; endDate?: string } = {}) {
        const supplier = this.getSupplier(supplierId);
        if (!supplier?.payable_account_id) throw new Error('Supplier does not have a linked payable account');
        return this.getPartyStatement({
            accountId: supplier.payable_account_id,
            party: supplier,
            startDate: filters.startDate,
            endDate: filters.endDate,
            normalSide: 'CREDIT',
            invoiceTypes: ['PURCHASE_INVOICE'],
            paymentTypes: ['SUPPLIER_PAYMENT'],
            returnTypes: ['PURCHASE_RETURN']
        });
    }

    private getPartyStatement(input: {
        accountId: number;
        party: any;
        startDate?: string;
        endDate?: string;
        normalSide: 'DEBIT' | 'CREDIT';
        invoiceTypes: string[];
        paymentTypes: string[];
        returnTypes: string[];
    }) {
        const sign = (debit: number, credit: number) => input.normalSide === 'DEBIT'
            ? debit - credit
            : credit - debit;
        const openingParams: any[] = [input.accountId];
        const openingClauses = ['jl.account_id = ?', 'je.posted = 1'];
        if (input.startDate) {
            openingClauses.push('je.date < ?');
            openingParams.push(input.startDate);
        }
        const opening = input.startDate
            ? this.db.prepare(`
                SELECT COALESCE(SUM(jl.debit), 0) as debit, COALESCE(SUM(jl.credit), 0) as credit
                FROM journal_lines jl
                JOIN journal_entries je ON je.id = jl.entry_id
                WHERE ${openingClauses.join(' AND ')}
            `).get(...openingParams) as { debit: number; credit: number }
            : { debit: 0, credit: 0 };

        const params: any[] = [input.accountId];
        const clauses = ['jl.account_id = ?', 'je.posted = 1'];
        if (input.startDate) {
            clauses.push('je.date >= ?');
            params.push(input.startDate);
        }
        if (input.endDate) {
            clauses.push('je.date <= ?');
            params.push(input.endDate);
        }
        const rows = this.db.prepare(`
            SELECT je.id as journal_entry_id, je.date, je.description, je.source_type, je.source_id,
                   jl.debit, jl.credit, jl.description as line_description
            FROM journal_lines jl
            JOIN journal_entries je ON je.id = jl.entry_id
            WHERE ${clauses.join(' AND ')}
            ORDER BY je.date ASC, je.created_at ASC, jl.id ASC
        `).all(...params) as any[];

        let running = sign(opening.debit || 0, opening.credit || 0);
        const items = rows.map(row => {
            const amount = sign(row.debit || 0, row.credit || 0);
            running += amount;
            const type = input.invoiceTypes.includes(row.source_type)
                ? 'invoice'
                : input.paymentTypes.includes(row.source_type)
                    ? 'payment'
                    : input.returnTypes.includes(row.source_type)
                        ? 'return'
                        : 'journal';
            return { ...row, type, amount, running_balance: running };
        });

        return {
            party: input.party,
            opening_balance: sign(opening.debit || 0, opening.credit || 0),
            items,
            closing_balance: running
        };
    }

    private getAccountByCode(code: string) {
        return this.db.prepare('SELECT id FROM accounts WHERE code = ?').get(code) as { id: number } | undefined;
    }

    private getAccountBySystemRole(role: string) {
        return this.db.prepare('SELECT id FROM accounts WHERE system_role = ?').get(role) as { id: number } | undefined;
    }

    listPurchaseInvoices(filters: { supplierId?: number; branchId?: number; status?: string } = {}) {
        const clauses: string[] = [];
        const params: any[] = [];
        if (filters.supplierId) { clauses.push('supplier_id = ?'); params.push(filters.supplierId); }
        if (filters.branchId) { clauses.push('branch_id = ?'); params.push(filters.branchId); }
        if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        return this.db.prepare(`SELECT pi.*, s.name as supplier_name FROM purchase_invoices pi JOIN suppliers s ON s.id = pi.supplier_id ${where} ORDER BY pi.date DESC`).all(...params);
    }

    listSalesInvoices(filters: { customerId?: number; branchId?: number; status?: string } = {}) {
        const clauses: string[] = [];
        const params: any[] = [];
        if (filters.customerId) { clauses.push('customer_id = ?'); params.push(filters.customerId); }
        if (filters.branchId) { clauses.push('branch_id = ?'); params.push(filters.branchId); }
        if (filters.status) { clauses.push('status = ?'); params.push(filters.status); }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        return this.db.prepare(`SELECT si.*, c.name as customer_name FROM sales_invoices si JOIN customers c ON c.id = si.customer_id ${where} ORDER BY si.date DESC`).all(...params);
    }
}

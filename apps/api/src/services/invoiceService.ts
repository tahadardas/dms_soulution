import { Database as DatabaseType } from 'better-sqlite3';
import crypto from 'crypto';
import { InventoryService } from './inventoryService';
import { AccountingService } from './accountingService';
import { TABLES } from '../db/schema';

export interface InvoiceLine {
    product_id: number;
    quantity: number;
    unit_price: number;
    tax_amount?: number;
}

export interface PurchaseInvoiceInput {
    supplier_id: number;
    branch_id: number;
    invoice_number: string;
    date: string;
    lines: InvoiceLine[];
    notes?: string;
}

export interface SalesInvoiceInput {
    customer_id: number;
    branch_id: number;
    invoice_number: string;
    date: string;
    lines: (InvoiceLine & { cost_at_time?: number })[];
    notes?: string;
}

export class InvoiceService {
    private db: DatabaseType;
    private inventoryService: InventoryService;
    private accountingService: AccountingService;

    constructor(db: DatabaseType) {
        this.db = db;
        this.inventoryService = new InventoryService(db);
        this.accountingService = new AccountingService(db);
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
        return this.db.transaction(() => {
            const stmt = this.db.prepare(`
                INSERT INTO suppliers (name, phone, email, address, tax_number, currency_code, payment_terms_days, opening_balance)
                VALUES (@name, @phone, @email, @address, @tax_number, @currency_code, @payment_terms_days, @opening_balance)
            `);
            const info = stmt.run({
                ...data,
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
        return this.db.transaction(() => {
            const stmt = this.db.prepare(`
                INSERT INTO customers (name, phone, email, address, tax_number, currency_code, opening_balance)
                VALUES (@name, @phone, @email, @address, @tax_number, @currency_code, @opening_balance)
            `);
            const info = stmt.run({
                ...data,
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
            const totalAmount = input.lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);
            const totalTax = input.lines.reduce((sum, l) => sum + (l.tax_amount || 0), 0);

            this.db.prepare(`
                INSERT INTO purchase_invoices (id, supplier_id, branch_id, invoice_number, date, status, total_amount, tax_amount, notes, created_by)
                VALUES (@id, @supplier_id, @branch_id, @invoice_number, @date, 'DRAFT', @total_amount, @tax_amount, @notes, @created_by)
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                tax_amount: totalTax,
                created_by: userId
            });

            const lineStmt = this.db.prepare(`
                INSERT INTO purchase_invoice_lines (invoice_id, product_id, quantity, unit_price, total_price, tax_amount)
                VALUES (@invoice_id, @product_id, @quantity, @unit_price, @total_price, @tax_amount)
            `);

            for (const line of input.lines) {
                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    total_price: line.quantity * line.unit_price,
                    tax_amount: line.tax_amount || 0
                });
            }

            return this.getPurchaseInvoice(id);
        })();
    }

    updatePurchaseInvoice(id: string, input: PurchaseInvoiceInput) {
        return this.db.transaction(() => {
            const current = this.getPurchaseInvoice(id);
            if (!current) throw new Error('Invoice not found');
            if (current.status !== 'DRAFT') throw new Error('Only draft invoices can be updated');

            const totalAmount = input.lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);
            const totalTax = input.lines.reduce((sum, l) => sum + (l.tax_amount || 0), 0);

            this.db.prepare(`
                UPDATE purchase_invoices 
                SET supplier_id = @supplier_id, branch_id = @branch_id, invoice_number = @invoice_number, 
                    date = @date, total_amount = @total_amount, tax_amount = @total_tax, notes = @notes
                WHERE id = @id
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                total_tax: totalTax
            });

            this.db.prepare('DELETE FROM purchase_invoice_lines WHERE invoice_id = ?').run(id);

            const lineStmt = this.db.prepare(`
                INSERT INTO purchase_invoice_lines (invoice_id, product_id, quantity, unit_price, total_price, tax_amount)
                VALUES (@invoice_id, @product_id, @quantity, @unit_price, @total_price, @tax_amount)
            `);

            for (const line of input.lines) {
                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    total_price: line.quantity * line.unit_price,
                    tax_amount: line.tax_amount || 0
                });
            }

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
                    unitCost: line.unit_price,
                    type: 'PURCHASE',
                    referenceId: invoice.id,
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

            const journalLines = [
                { 
                    account_id: inventoryAccount.id, 
                    debit: invoice.total_amount, 
                    credit: 0, 
                    description: `Inventory Increase - Inv ${invoice.invoice_number}` 
                },
                { 
                    account_id: supplier.payable_account_id, 
                    debit: 0, 
                    credit: invoice.total_amount + (invoice.tax_amount || 0), 
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
            this.db.prepare('UPDATE purchase_invoices SET status = \'POSTED\' WHERE id = ?').run(id);

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
            const totalAmount = input.lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);
            const totalTax = input.lines.reduce((sum, l) => sum + (l.tax_amount || 0), 0);

            this.db.prepare(`
                INSERT INTO sales_invoices (id, customer_id, branch_id, invoice_number, date, status, total_amount, tax_amount, payment_status, notes, created_by)
                VALUES (@id, @customer_id, @branch_id, @invoice_number, @date, 'DRAFT', @total_amount, @tax_amount, 'UNPAID', @notes, @created_by)
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                tax_amount: totalTax,
                created_by: userId
            });

            const lineStmt = this.db.prepare(`
                INSERT INTO sales_invoice_lines (invoice_id, product_id, quantity, unit_price, cost_at_time, total_price, tax_amount)
                VALUES (@invoice_id, @product_id, @quantity, @unit_price, @cost_at_time, @total_price, @tax_amount)
            `);

            for (const line of input.lines) {
                // Get current cost if not provided
                let cost = line.cost_at_time;
                if (cost === undefined) {
                    const stock = this.inventoryService.getStockLevel({ branchId: input.branch_id, productId: line.product_id });
                    cost = stock.averageCost;
                }

                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    cost_at_time: cost,
                    total_price: line.quantity * line.unit_price,
                    tax_amount: line.tax_amount || 0
                });
            }

            return this.getSalesInvoice(id);
        })();
    }

    updateSalesInvoice(id: string, input: SalesInvoiceInput) {
        return this.db.transaction(() => {
            const current = this.getSalesInvoice(id);
            if (!current) throw new Error('Invoice not found');
            if (current.status !== 'DRAFT') throw new Error('Only draft invoices can be updated');

            const totalAmount = input.lines.reduce((sum, l) => sum + (l.quantity * l.unit_price), 0);
            const totalTax = input.lines.reduce((sum, l) => sum + (l.tax_amount || 0), 0);

            this.db.prepare(`
                UPDATE sales_invoices 
                SET customer_id = @customer_id, branch_id = @branch_id, invoice_number = @invoice_number, 
                    date = @date, total_amount = @total_amount, tax_amount = @total_tax, notes = @notes
                WHERE id = @id
            `).run({
                id,
                ...input,
                total_amount: totalAmount,
                total_tax: totalTax
            });

            this.db.prepare('DELETE FROM sales_invoice_lines WHERE invoice_id = ?').run(id);

            const lineStmt = this.db.prepare(`
                INSERT INTO sales_invoice_lines (invoice_id, product_id, quantity, unit_price, cost_at_time, total_price, tax_amount)
                VALUES (@invoice_id, @product_id, @quantity, @unit_price, @cost_at_time, @total_price, @tax_amount)
            `);

            for (const line of input.lines) {
                let cost = line.cost_at_time;
                if (cost === undefined) {
                    const stock = this.inventoryService.getStockLevel({ branchId: input.branch_id, productId: line.product_id });
                    cost = stock.averageCost;
                }
                lineStmt.run({
                    invoice_id: id,
                    product_id: line.product_id,
                    quantity: line.quantity,
                    unit_price: line.unit_price,
                    cost_at_time: cost,
                    total_price: line.quantity * line.unit_price,
                    tax_amount: line.tax_amount || 0
                });
            }

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
            this.db.prepare('UPDATE sales_invoices SET status = \'POSTED\' WHERE id = ?').run(id);

            return { success: true, journal_entry_id: journal.id };
        })();
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

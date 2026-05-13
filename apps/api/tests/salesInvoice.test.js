const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { InvoiceService } = require('../src/services/invoiceService');
const { InventoryService } = require('../src/services/inventoryService');

const createProductWithStock = (db) => {
    const productId = Number(db.prepare(`
        INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level)
        VALUES ('Sales Product', 'SAL-1', 'FINISHED_GOOD', 15, 4, 0, 0)
    `).run().lastInsertRowid);
    new InventoryService(db).stockIn({ branchId: 1, productId, quantity: 10, unitCost: 4, referenceId: 'OPEN-SALES' });
    return productId;
};

test('sales invoice posts AR, revenue, VAT, COGS, inventory, and metadata', () => {
    const db = initDB();
    const service = new InvoiceService(db);
    const customer = service.createCustomer({ name: 'زبون اختبار', phone: '0988000001' });
    const productId = createProductWithStock(db);

    const invoice = service.createSalesInvoice({
        customer_id: customer.id,
        branch_id: 1,
        invoice_number: 'SI-001',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 2, unit_price: 15, tax_amount: 3, discount_amount: 2 }]
    }, 1);

    const result = service.postSalesInvoice(invoice.id, 1);
    const posted = db.prepare('SELECT status, payment_status, journal_entry_id, posted_by, posted_at FROM sales_invoices WHERE id = ?').get(invoice.id);
    assert.equal(posted.status, 'POSTED');
    assert.equal(posted.payment_status, 'UNPAID');
    assert.equal(posted.journal_entry_id, result.journal_entry_id);
    assert.equal(posted.posted_by, 1);
    assert.ok(posted.posted_at);

    const stock = db.prepare('SELECT quantity_on_hand FROM inventory_stock WHERE product_id = ? AND branch_id = 1').get(productId);
    assert.equal(stock.quantity_on_hand, 8);
    const totals = db.prepare('SELECT SUM(debit) as debit, SUM(credit) as credit FROM journal_lines WHERE entry_id = ?').get(result.journal_entry_id);
    assert.equal(totals.debit, totals.credit);
    assert.throws(() => service.postSalesInvoice(invoice.id, 1), /Only draft invoices can be posted/i);
    db.close();
});

test('sales invoice supports partial and full payments', () => {
    const db = initDB();
    const service = new InvoiceService(db);
    const customer = service.createCustomer({ name: 'زبون دفعات', phone: '0988000002' });
    const productId = createProductWithStock(db);
    const cash = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const invoice = service.createSalesInvoice({
        customer_id: customer.id,
        branch_id: 1,
        invoice_number: 'SI-002',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 2, unit_price: 10 }]
    }, 1);
    service.postSalesInvoice(invoice.id, 1);

    const partial = service.recordSalesInvoicePayment(invoice.id, {
        account_id: cash.id,
        amount: 5,
        date: '2026-01-02',
        payment_method: 'CASH'
    }, 1);
    assert.equal(partial.payment_status, 'PARTIAL');

    const paid = service.recordSalesInvoicePayment(invoice.id, {
        account_id: cash.id,
        amount: 15,
        date: '2026-01-03',
        payment_method: 'CASH'
    }, 1);
    assert.equal(paid.payment_status, 'PAID');
    db.close();
});

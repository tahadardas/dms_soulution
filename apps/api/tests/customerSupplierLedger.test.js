const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { InvoiceService } = require('../src/services/invoiceService');
const { InventoryService } = require('../src/services/inventoryService');

const productWithStock = (db) => {
    const id = Number(db.prepare(`
        INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level)
        VALUES ('Ledger Product', 'LEDGER-PROD-1', 'FINISHED_GOOD', 20, 5, 0, 0)
    `).run().lastInsertRowid);
    new InventoryService(db).stockIn({ branchId: 1, productId: id, quantity: 20, unitCost: 5, referenceId: 'LEDGER-STOCK' });
    return id;
};

test('customer statement includes opening, invoice, payment, and closing balance', () => {
    const db = initDB();
    const service = new InvoiceService(db);
    const customer = service.createCustomer({ name: 'عميل كشف', phone: '0977000001' });
    const productId = productWithStock(db);
    const cash = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const invoice = service.createSalesInvoice({
        customer_id: customer.id,
        branch_id: 1,
        invoice_number: 'CS-001',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 1, unit_price: 20 }]
    }, 1);
    service.postSalesInvoice(invoice.id, 1);
    service.recordSalesInvoicePayment(invoice.id, {
        account_id: cash.id,
        amount: 8,
        date: '2026-01-02',
        payment_method: 'CASH'
    }, 1);

    const statement = service.getCustomerStatement(customer.id);
    assert.equal(statement.opening_balance, 0);
    assert.ok(statement.items.some(item => item.type === 'invoice' && item.amount === 20));
    assert.ok(statement.items.some(item => item.type === 'payment' && item.amount === -8));
    assert.equal(statement.closing_balance, 12);
    db.close();
});

test('supplier statement includes invoice and payment on payable account', () => {
    const db = initDB();
    const service = new InvoiceService(db);
    const supplier = service.createSupplier({ name: 'مورد كشف', phone: '0966000001' });
    const productId = Number(db.prepare(`
        INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level)
        VALUES ('Supplier Ledger Product', 'SUP-LEDGER-1', 'RAW_MATERIAL', 0, 0, 0, 0)
    `).run().lastInsertRowid);
    const cash = db.prepare("SELECT id FROM accounts WHERE code = '1010'").get();
    const invoice = service.createPurchaseInvoice({
        supplier_id: supplier.id,
        branch_id: 1,
        invoice_number: 'PS-001',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 1, unit_price: 30 }]
    }, 1);
    service.postPurchaseInvoice(invoice.id, 1);
    service.recordSupplierPayment({
        supplier_id: supplier.id,
        branch_id: 1,
        account_id: cash.id,
        amount: 10,
        date: '2026-01-02',
        payment_method: 'CASH'
    }, 1);

    const statement = service.getSupplierStatement(supplier.id);
    assert.ok(statement.items.some(item => item.type === 'invoice' && item.amount === 30));
    assert.ok(statement.items.some(item => item.type === 'payment' && item.amount === -10));
    assert.equal(statement.closing_balance, 20);
    db.close();
});

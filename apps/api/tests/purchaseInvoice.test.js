const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { InvoiceService } = require('../src/services/invoiceService');

const createProduct = (db) => Number(db.prepare(`
    INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level)
    VALUES ('Purchase Product', 'PUR-1', 'RAW_MATERIAL', 0, 0, 0, 0)
`).run().lastInsertRowid);

test('purchase invoice posts inventory, VAT input, supplier payable, and metadata', () => {
    const db = initDB();
    const service = new InvoiceService(db);
    const supplier = service.createSupplier({ name: 'مورد اختبار', phone: '0991000001' });
    const productId = createProduct(db);

    const invoice = service.createPurchaseInvoice({
        supplier_id: supplier.id,
        branch_id: 1,
        invoice_number: 'PI-001',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 2, unit_price: 10, tax_amount: 2, discount_amount: 1 }],
        landed_cost_amount: 3
    }, 1);

    const result = service.postPurchaseInvoice(invoice.id, 1);
    assert.ok(result.journal_entry_id);
    const posted = db.prepare('SELECT status, journal_entry_id, posted_by, posted_at FROM purchase_invoices WHERE id = ?').get(invoice.id);
    assert.equal(posted.status, 'POSTED');
    assert.equal(posted.journal_entry_id, result.journal_entry_id);
    assert.equal(posted.posted_by, 1);
    assert.ok(posted.posted_at);

    const stock = db.prepare('SELECT quantity_on_hand FROM inventory_stock WHERE product_id = ? AND branch_id = 1').get(productId);
    assert.equal(stock.quantity_on_hand, 2);

    const totals = db.prepare(`
        SELECT SUM(jl.debit) as debit, SUM(jl.credit) as credit
        FROM journal_lines jl
        WHERE jl.entry_id = ?
    `).get(result.journal_entry_id);
    assert.equal(totals.debit, totals.credit);
    assert.throws(() => service.postPurchaseInvoice(invoice.id, 1), /Only draft invoices can be posted/i);
    db.close();
});

test('purchase invoice cannot be edited after posting', () => {
    const db = initDB();
    const service = new InvoiceService(db);
    const supplier = service.createSupplier({ name: 'مورد تعديل', phone: '0991000002' });
    const productId = createProduct(db);
    const invoice = service.createPurchaseInvoice({
        supplier_id: supplier.id,
        branch_id: 1,
        invoice_number: 'PI-002',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 1, unit_price: 5 }]
    }, 1);
    service.postPurchaseInvoice(invoice.id, 1);

    assert.throws(() => service.updatePurchaseInvoice(invoice.id, {
        supplier_id: supplier.id,
        branch_id: 1,
        invoice_number: 'PI-002',
        date: '2026-01-02',
        lines: [{ product_id: productId, quantity: 1, unit_price: 6 }]
    }), /Only draft invoices can be updated/i);
    db.close();
});

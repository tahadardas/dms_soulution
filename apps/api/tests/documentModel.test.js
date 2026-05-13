const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { InvoiceService } = require('../src/services/invoiceService');
const { DocumentService } = require('../src/services/documentService');

const createProduct = (db, sku = 'DOC-PROD') => Number(db.prepare(`
    INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level)
    VALUES ('Document Product', ?, 'RAW_MATERIAL', 20, 0, 0, 0)
`).run(sku).lastInsertRowid);

test('document model seeds document types and base currencies', () => {
    const db = initDB();
    const documentTypes = db.prepare('SELECT code FROM document_types ORDER BY code').all().map(row => row.code);
    assert.ok(documentTypes.includes('POS_ORDER'));
    assert.ok(documentTypes.includes('SALES_INVOICE'));
    assert.ok(documentTypes.includes('PURCHASE_INVOICE'));
    assert.ok(documentTypes.includes('CUSTOMER_RECEIPT'));

    const currencies = db.prepare('SELECT code FROM currencies ORDER BY code').all().map(row => row.code);
    assert.deepEqual(currencies, ['SYP', 'USD']);
    db.close();
});

test('purchase invoice lifecycle syncs unified document status and totals', () => {
    const db = initDB();
    const invoiceService = new InvoiceService(db);
    const documentService = new DocumentService(db);
    const supplier = invoiceService.createSupplier({ name: 'مورد مستند', phone: '0992000001' });
    const productId = createProduct(db, 'DOC-PUR-1');

    const invoice = invoiceService.createPurchaseInvoice({
        supplier_id: supplier.id,
        branch_id: 1,
        invoice_number: 'DOC-PI-001',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 2, unit_price: 10, tax_amount: 2, discount_amount: 1 }]
    }, 1);

    const draftDocument = documentService.getDocument('PURCHASE_INVOICE', invoice.id);
    assert.equal(draftDocument.status, 'DRAFT');
    assert.equal(draftDocument.total_before_discount, 20);
    assert.equal(draftDocument.discount_amount, 1);
    assert.equal(draftDocument.tax_amount, 2);
    assert.equal(draftDocument.total_amount, 21);

    const posted = invoiceService.postPurchaseInvoice(invoice.id, 1);
    const postedDocument = documentService.getDocument('PURCHASE_INVOICE', invoice.id);
    assert.equal(postedDocument.status, 'POSTED');
    assert.equal(postedDocument.journal_entry_id, posted.journal_entry_id);
    assert.equal(postedDocument.posted_by, 1);
    db.close();
});

test('sales invoice payment creates customer receipt document link', () => {
    const db = initDB();
    const invoiceService = new InvoiceService(db);
    const documentService = new DocumentService(db);
    const customer = invoiceService.createCustomer({ name: 'عميل مستند', phone: '0992000002' });
    const supplier = invoiceService.createSupplier({ name: 'مورد مخزون مستند', phone: '0992000003' });
    const productId = createProduct(db, 'DOC-SALE-1');

    const purchase = invoiceService.createPurchaseInvoice({
        supplier_id: supplier.id,
        branch_id: 1,
        invoice_number: 'DOC-PI-002',
        date: '2026-01-01',
        lines: [{ product_id: productId, quantity: 2, unit_price: 5 }]
    }, 1);
    invoiceService.postPurchaseInvoice(purchase.id, 1);

    const sale = invoiceService.createSalesInvoice({
        customer_id: customer.id,
        branch_id: 1,
        invoice_number: 'DOC-SI-001',
        date: '2026-01-02',
        lines: [{ product_id: productId, quantity: 1, unit_price: 20 }]
    }, 1);
    invoiceService.postSalesInvoice(sale.id, 1);
    const receipt = invoiceService.recordSalesInvoicePayment(sale.id, {
        account_id: db.prepare("SELECT id FROM accounts WHERE code = '1010'").get().id,
        amount: 20,
        date: '2026-01-03',
        payment_method: 'CASH'
    }, 1);

    const receiptDocument = documentService.getDocument('CUSTOMER_RECEIPT', receipt.receipt_id);
    assert.equal(receiptDocument.status, 'POSTED');
    assert.equal(receiptDocument.total_amount, 20);

    const link = db.prepare(`
        SELECT *
        FROM source_document_links
        WHERE source_document_type = 'CUSTOMER_RECEIPT'
          AND source_document_id = ?
          AND linked_document_type = 'SALES_INVOICE'
          AND linked_document_id = ?
    `).get(receipt.receipt_id, sale.id);
    assert.ok(link);
    db.close();
});

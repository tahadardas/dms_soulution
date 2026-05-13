const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { POSService } = require('../src/services/pos.service');
const { AccountingService } = require('../src/services/accountingService');
const { InventoryService } = require('../src/services/inventoryService');

const createDb = () => {
    const db = initDB();
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    return { db, admin };
};

const seedProductStock = (db, productId, quantity, unitCost) => {
    const inventoryService = new InventoryService(db);
    inventoryService.stockIn({
        branchId: 1,
        productId: Number(productId),
        quantity,
        unitCost,
        type: 'OPENING_BALANCE',
        referenceId: `TEST-OPENING-${productId}`
    });
};

test('open session flow', () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 100
    });

    assert.ok(session.id);
    assert.equal(session.status, 'OPEN');
    const row = db.prepare('SELECT status FROM pos_sessions WHERE id = ?').get(session.id);
    assert.equal(row.status, 'OPEN');
    db.close();
});

test('close session records small cash difference with reason and requires manager for large difference', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);
    const cashierId = Number(db.prepare(`
        INSERT INTO users (username, password_hash, role_id, branch_id)
        VALUES (?, ?, ?, ?)
    `).run('cashier-close-test', 'not-used-in-service-test', 'cashier', 1).lastInsertRowid);

    const smallDiffSession = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 100
    });

    const closed = await posService.closeSession({
        sessionId: smallDiffSession.id,
        closingCash: 98,
        reason: 'Short by customer change correction',
        userId: admin.id
    });

    assert.equal(closed.cashDifference, -2);
    const closedRow = db.prepare('SELECT status, cash_difference, cash_difference_reason FROM pos_sessions WHERE id = ?').get(smallDiffSession.id);
    assert.equal(closedRow.status, 'CLOSED');
    assert.equal(closedRow.cash_difference, -2);
    assert.equal(closedRow.cash_difference_reason, 'Short by customer change correction');

    const largeDiffSession = posService.openSession({
        userId: cashierId,
        branchId: 1,
        openingCash: 100
    });

    await assert.rejects(
        () => posService.closeSession({
            sessionId: largeDiffSession.id,
            closingCash: 40,
            reason: 'Large shortage',
            userId: cashierId
        }),
        /يتطلب موافقة مدير/
    );

    db.close();
});

test('submit order flow posts journal and updates inventory', () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Coffee', 'SKU-COF', 'FINISHED_GOOD', 5, 2, 50, 5).lastInsertRowid;
    seedProductStock(db, productId, 50, 2);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 100
    });

    const result = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 2 }]
    }, admin.id);

    assert.ok(result.orderId);
    const order = db.prepare('SELECT total_amount FROM orders WHERE id = ?').get(result.orderId);
    assert.equal(order.total_amount, 10);
    const orderBranch = db.prepare('SELECT branch_id FROM orders WHERE id = ?').get(result.orderId);
    assert.equal(orderBranch.branch_id, 1);

    const movements = db.prepare("SELECT count(*) as count FROM inventory_movements WHERE type = 'SALE' AND reference_id = ?").get(result.orderId);
    assert.equal(movements.count, 1);
    const stock = db.prepare('SELECT quantity_on_hand, average_cost FROM inventory_stock WHERE branch_id = ? AND product_id = ?').get(1, productId);
    assert.equal(stock.quantity_on_hand, 48);
    assert.equal(stock.average_cost, 2);

    const journal = db.prepare('SELECT posted FROM journal_entries WHERE source_id = ?').get(result.orderId);
    assert.equal(journal.posted, 1);

    const printJobs = db.prepare('SELECT count(*) as count FROM print_jobs WHERE payload LIKE ?').get(`%${result.orderId}%`);
    assert.equal(printJobs.count, 0);

    db.close();
});

test('order numbers use branch daily sequence', () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Sequence Coffee', 'SKU-SEQ-COF', 'FINISHED_GOOD', 5, 2, 50, 5).lastInsertRowid;
    seedProductStock(db, productId, 50, 2);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 100
    });

    const date = new Date();
    const dateKey = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

    const first = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 1 }]
    }, admin.id);
    const second = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 1 }]
    }, admin.id);

    assert.equal(first.orderNumber, `BR1-${dateKey}-000001`);
    assert.equal(second.orderNumber, `BR1-${dateKey}-000002`);

    const sequence = db.prepare(`
        SELECT current_value
        FROM sequences
        WHERE scope = 'ORDER' AND sequence_date = ? AND branch_id = 1
    `).get(dateKey);
    assert.equal(sequence.current_value, 2);

    db.close();
});

test('card payment does not increase expected cash', () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Card Coffee', 'SKU-CARD-COF', 'FINISHED_GOOD', 7, 2, 20, 5).lastInsertRowid;
    seedProductStock(db, productId, 20, 2);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 100
    });

    const result = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 2 }],
        paymentMethod: 'CARD'
    }, admin.id);

    const payment = db.prepare('SELECT method, session_id, amount FROM payments WHERE order_id = ?').get(result.orderId);
    assert.equal(payment.method, 'CARD');
    assert.equal(payment.session_id, session.id);
    assert.equal(payment.amount, 14);

    const stats = posService.getSessionStats(session.id);
    assert.equal(stats.expectedCash, 100);

    const bankAccount = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1020');
    const debit = db.prepare(`
        SELECT jl.debit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        WHERE je.source_id = ? AND jl.account_id = ?
    `).get(result.orderId, bankAccount.id);
    assert.equal(debit.debit, 14);

    db.close();
});

test('cash in and cash out affect expected cash', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 100
    });

    await posService.cashIn({
        sessionId: session.id,
        amount: 25,
        reason: 'Small cash top-up',
        method: 'CASH'
    }, admin.id);

    await posService.cashOut({
        sessionId: session.id,
        amount: 10,
        reason: 'Petty purchase',
        method: 'CASH'
    }, admin.id);

    const stats = posService.getSessionStats(session.id);
    assert.equal(stats.cashIn, 25);
    assert.equal(stats.cashOut, 10);
    assert.equal(stats.expectedCash, 115);

    const movements = db.prepare('SELECT type, amount, reason FROM cash_movements ORDER BY created_at, type').all();
    assert.equal(movements.length, 2);
    assert.equal(movements.find(row => row.type === 'CASH_IN').amount, 25);
    assert.equal(movements.find(row => row.type === 'CASH_OUT').amount, 10);

    db.close();
});

test('pending delivery cash is counted in collection session only', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);
    const collectorId = Number(db.prepare(`
        INSERT INTO users (username, password_hash, role_id, branch_id)
        VALUES (?, ?, ?, ?)
    `).run('collector', 'not-used-in-service-test', 'admin', 1).lastInsertRowid);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Delivery Meal', 'SKU-DEL-MEAL', 'FINISHED_GOOD', 12, 4, 20, 5).lastInsertRowid;
    seedProductStock(db, productId, 20, 4);

    const sourceSession = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 20
    });

    const order = posService.createOrder({
        sessionId: sourceSession.id,
        orderType: 'DELIVERY',
        paymentMode: 'PAY_LATER',
        items: [{ productId: Number(productId), quantity: 1 }]
    }, admin.id);

    assert.equal(posService.getSessionStats(sourceSession.id).expectedCash, 20);

    const collectionSession = posService.openSession({
        userId: collectorId,
        branchId: 1,
        openingCash: 5
    });

    await posService.collectDeliveryOrder(order.orderId, {
        amount: 12,
        paymentMethod: 'CASH',
        sessionId: collectionSession.id
    }, collectorId);

    assert.equal(posService.getSessionStats(sourceSession.id).expectedCash, 20);
    assert.equal(posService.getSessionStats(collectionSession.id).expectedCash, 17);

    const collectionPayment = db.prepare(`
        SELECT type, method, session_id, amount
        FROM payments
        WHERE order_id = ? AND type = 'DELIVERY_COLLECTION'
    `).get(order.orderId);
    assert.equal(collectionPayment.method, 'CASH');
    assert.equal(collectionPayment.session_id, collectionSession.id);
    assert.equal(collectionPayment.amount, 12);

    db.close();
});

test('pending delivery collection rejects wrong amounts and duplicate collection', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Delivery Exact Meal', 'SKU-DEL-EXACT', 'FINISHED_GOOD', 20, 7, 20, 5).lastInsertRowid;
    seedProductStock(db, productId, 20, 7);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 0
    });

    const order = posService.createOrder({
        sessionId: session.id,
        orderType: 'DELIVERY',
        paymentMode: 'PAY_LATER',
        items: [{ productId: Number(productId), quantity: 1 }]
    }, admin.id);

    await assert.rejects(
        () => posService.collectDeliveryOrder(order.orderId, {
            amount: 19,
            paymentMethod: 'CASH',
            sessionId: session.id
        }, admin.id),
        /المبلغ المحصل أقل من المبلغ المطلوب/
    );

    await assert.rejects(
        () => posService.collectDeliveryOrder(order.orderId, {
            amount: 21,
            paymentMethod: 'CASH',
            sessionId: session.id
        }, admin.id),
        /المبلغ المحصل أكبر من المبلغ المطلوب/
    );

    await posService.collectDeliveryOrder(order.orderId, {
        amount: 20,
        paymentMethod: 'CASH',
        sessionId: session.id
    }, admin.id);

    await assert.rejects(
        () => posService.collectDeliveryOrder(order.orderId, {
            amount: 20,
            paymentMethod: 'CASH',
            sessionId: session.id
        }, admin.id),
        /هذا الطلب تم تحصيله مسبقاً/
    );

    const payments = db.prepare(`
        SELECT COUNT(*) as count
        FROM payments
        WHERE order_id = ? AND type = 'DELIVERY_COLLECTION'
    `).get(order.orderId);
    assert.equal(payments.count, 1);

    db.close();
});

test('pending delivery non-cash collection posts to bank and keeps expected cash unchanged', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Delivery Card Meal', 'SKU-DEL-CARD', 'FINISHED_GOOD', 18, 6, 20, 5).lastInsertRowid;
    seedProductStock(db, productId, 20, 6);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 30
    });

    const order = posService.createOrder({
        sessionId: session.id,
        orderType: 'DELIVERY',
        paymentMode: 'PAY_LATER',
        items: [{ productId: Number(productId), quantity: 1 }]
    }, admin.id);

    await posService.collectDeliveryOrder(order.orderId, {
        amount: 18,
        paymentMethod: 'CARD',
        sessionId: session.id
    }, admin.id);

    assert.equal(posService.getSessionStats(session.id).expectedCash, 30);

    const payment = db.prepare(`
        SELECT type, method, session_id, amount
        FROM payments
        WHERE order_id = ? AND type = 'DELIVERY_COLLECTION'
    `).get(order.orderId);
    assert.equal(payment.method, 'CARD');
    assert.equal(payment.session_id, session.id);
    assert.equal(payment.amount, 18);
    assert.equal(db.prepare('SELECT payment_method FROM orders WHERE id = ?').get(order.orderId).payment_method, 'CARD');

    const bankAccount = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1020');
    const debit = db.prepare(`
        SELECT jl.debit
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        WHERE je.source_id = ? AND je.source_type = 'POS_DELIVERY_COLLECTION' AND jl.account_id = ?
        ORDER BY je.created_at DESC
        LIMIT 1
    `).get(order.orderId, bankAccount.id);
    assert.equal(debit.debit, 18);

    db.close();
});

test('void pending delivery restores stock and reverses posted journals', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Void Delivery Meal', 'SKU-VOID-DEL', 'FINISHED_GOOD', 15, 5, 10, 2).lastInsertRowid;
    seedProductStock(db, productId, 10, 5);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 0
    });

    const order = posService.createOrder({
        sessionId: session.id,
        orderType: 'DELIVERY',
        paymentMode: 'PAY_LATER',
        items: [{ productId: Number(productId), quantity: 2 }]
    }, admin.id);

    assert.equal(db.prepare('SELECT quantity_on_hand FROM inventory_stock WHERE product_id = ?').get(productId).quantity_on_hand, 8);

    await posService.voidOrder({
        orderId: order.orderId,
        reason: 'Customer cancelled before dispatch'
    }, admin.id);

    const voided = db.prepare('SELECT status, payment_status, void_reason FROM orders WHERE id = ?').get(order.orderId);
    assert.equal(voided.status, 'VOID');
    assert.equal(voided.payment_status, 'VOID');
    assert.equal(voided.void_reason, 'Customer cancelled before dispatch');
    assert.equal(db.prepare('SELECT quantity_on_hand FROM inventory_stock WHERE product_id = ?').get(productId).quantity_on_hand, 10);

    const reversals = db.prepare(`
        SELECT COUNT(*) as count
        FROM journal_entries
        WHERE source_type = 'REVERSAL'
          AND reversed_of IN (SELECT id FROM journal_entries WHERE source_id = ?)
    `).get(order.orderId);
    assert.equal(reversals.count, 1);

    db.close();
});

test('paid order void requires manager approval', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Paid Void Meal', 'SKU-VOID-PAID', 'FINISHED_GOOD', 10, 3, 10, 2).lastInsertRowid;
    seedProductStock(db, productId, 10, 3);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 0
    });

    const order = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 1 }]
    }, admin.id);

    await assert.rejects(
        () => posService.voidOrder({
            orderId: order.orderId,
            reason: 'Wrong item'
        }, admin.id),
        /يتطلب موافقة مدير/
    );

    db.close();
});

test('return items flow creates reversal entry', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Sandwich', 'SKU-SAND', 'FINISHED_GOOD', 8, 3, 20, 2).lastInsertRowid;
    seedProductStock(db, productId, 20, 3);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 50
    });

    const order = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 2 }]
    }, admin.id);

    const orderLine = db.prepare('SELECT id FROM order_lines WHERE order_id = ?').get(order.orderId);

    const result = await posService.createReturn({
        orderId: order.orderId,
        reason: 'Damaged item',
        sessionId: session.id,
        items: [{ orderLineId: orderLine.id, quantity: 1 }]
    }, admin.id);

    assert.ok(result.returnId);
    const returnsCount = db.prepare('SELECT count(*) as count FROM returns').get();
    assert.equal(returnsCount.count, 1);

    const returnLines = db.prepare('SELECT count(*) as count FROM return_lines').get();
    assert.equal(returnLines.count, 1);

    const journal = db.prepare('SELECT posted FROM journal_entries WHERE source_id = ?').get(result.returnId);
    assert.equal(journal.posted, 1);

    const stock = db.prepare('SELECT quantity_on_hand FROM inventory_stock WHERE branch_id = ? AND product_id = ?').get(1, productId);
    assert.equal(stock.quantity_on_hand, 19);

    db.close();
});

test('large return uses calculated refund total before manager policy', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const posSettings = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'pos'").get().value);
    posSettings.managerRequiredReturnAmount = 8;
    db.prepare("UPDATE settings SET value = ? WHERE key = 'pos'").run(JSON.stringify(posSettings));

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Return Approval Meal', 'SKU-RET-APPROVAL', 'FINISHED_GOOD', 10, 4, 20, 2).lastInsertRowid;
    seedProductStock(db, productId, 20, 4);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 50
    });

    const order = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 1 }]
    }, admin.id);

    const orderLine = db.prepare('SELECT id FROM order_lines WHERE order_id = ?').get(order.orderId);

    await assert.rejects(
        () => posService.createReturn({
            orderId: order.orderId,
            reason: 'High value return',
            sessionId: session.id,
            items: [{ orderLineId: orderLine.id, quantity: 1 }]
        }, admin.id),
        /يتطلب موافقة مدير/
    );

    assert.equal(db.prepare('SELECT COUNT(*) as count FROM returns').get().count, 0);

    db.close();
});

test('recipe return does not restore components or reverse COGS', async () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const doughId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Return Dough', 'SKU-RET-DOUGH', 'RAW_MATERIAL', 0, 1, 10, 2).lastInsertRowid;
    const pizzaId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Return Pizza', 'SKU-RET-PIZZA', 'FINISHED_GOOD', 12, 5, 0, 0).lastInsertRowid;
    db.prepare('INSERT INTO recipes (product_id, ingredient_id, quantity, waste_percent) VALUES (?, ?, ?, ?)').run(pizzaId, doughId, 2, 0);
    seedProductStock(db, doughId, 10, 1);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 50
    });

    const order = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(pizzaId), quantity: 1 }]
    }, admin.id);

    assert.equal(db.prepare('SELECT quantity_on_hand FROM inventory_stock WHERE branch_id = 1 AND product_id = ?').get(doughId).quantity_on_hand, 8);
    const orderLine = db.prepare('SELECT id FROM order_lines WHERE order_id = ?').get(order.orderId);

    const result = await posService.createReturn({
        orderId: order.orderId,
        reason: 'Recipe return policy',
        sessionId: session.id,
        items: [{ orderLineId: orderLine.id, quantity: 1 }]
    }, admin.id);

    assert.equal(db.prepare('SELECT quantity_on_hand FROM inventory_stock WHERE branch_id = 1 AND product_id = ?').get(doughId).quantity_on_hand, 8);
    const inventoryMovement = db.prepare("SELECT COUNT(*) as count FROM inventory_movements WHERE reference_id = ? AND type = 'RETURN'").get(result.returnId);
    assert.equal(inventoryMovement.count, 0);

    const inventoryAccount = db.prepare("SELECT id FROM accounts WHERE code = '1200'").get();
    const cogsAccount = db.prepare("SELECT id FROM accounts WHERE code = '5100'").get();
    const cogsReversalLines = db.prepare(`
        SELECT COUNT(*) as count
        FROM journal_lines jl
        JOIN journal_entries je ON je.id = jl.entry_id
        WHERE je.source_id = ?
          AND jl.account_id IN (?, ?)
    `).get(result.returnId, inventoryAccount.id, cogsAccount.id);
    assert.equal(cogsReversalLines.count, 0);

    db.close();
});

test('order notes persist', () => {
    const { db, admin } = createDb();
    const posService = new POSService(db);

    const productId = db.prepare(
        'INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Tea', 'SKU-TEA', 'FINISHED_GOOD', 4, 1.5, 10, 2).lastInsertRowid;
    seedProductStock(db, productId, 10, 1.5);

    const session = posService.openSession({
        userId: admin.id,
        branchId: 1,
        openingCash: 20
    });

    const result = posService.createOrder({
        sessionId: session.id,
        items: [{ productId: Number(productId), quantity: 1 }],
        notes: ['No sugar', 'Extra hot'],
        printNow: true, // This flag should be ignored for order creation - printing is explicit via print endpoint
        printTypes: ['KOT']
    }, admin.id);

    const notes = db.prepare(`
        SELECT n.content, n.created_by, u.username as created_by_name
        FROM order_notes n
        LEFT JOIN users u ON u.id = n.created_by
        WHERE n.order_id = ?
        ORDER BY n.id
    `).all(result.orderId);
    assert.equal(notes.length, 2);
    assert.equal(notes[0].created_by, admin.id);
    assert.equal(notes[0].created_by_name, 'admin');

    const line = db.prepare('SELECT cost_at_time FROM order_lines WHERE order_id = ? LIMIT 1').get(result.orderId);
    assert.equal(line.cost_at_time, 1.5);

    // Important: Saving an order should NOT automatically create print jobs
    // Printing is an explicit action via the print endpoint
    const printJobCount = db.prepare('SELECT COUNT(*) as count FROM print_jobs WHERE payload LIKE ?').get(`%"order_id":"${result.orderId}"%`);
    assert.equal(printJobCount.count, 0);

    db.close();
});

test('post journal and trial balance', () => {
    const { db } = createDb();
    const accountingService = new AccountingService(db);

    const cashAccount = db.prepare('SELECT id FROM accounts WHERE code = ?').get('1010');
    const salesAccount = db.prepare('SELECT id FROM accounts WHERE code = ?').get('4100');

    const entry = accountingService.createJournalEntry({
        date: new Date().toISOString(),
        description: 'Test Entry',
        source_type: 'TEST',
        source_id: 'TEST-1',
        lines: [
            { account_id: cashAccount.id, debit: 100, credit: 0, description: 'Debit cash' },
            { account_id: salesAccount.id, debit: 0, credit: 100, description: 'Credit sales' }
        ]
    });

    accountingService.postEntry(entry.id);

    const posted = db.prepare('SELECT posted FROM journal_entries WHERE id = ?').get(entry.id);
    assert.equal(posted.posted, 1);

    const trial = accountingService.getTrialBalance();
    const rows = trial.items || [];
    const totalDebit = rows.reduce((sum, row) => sum + (row.total_debit || 0), 0);
    const totalCredit = rows.reduce((sum, row) => sum + (row.total_credit || 0), 0);
    assert.ok(Math.abs(totalDebit - totalCredit) < 0.001);

    db.close();
});


const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { POSService } = require('../src/services/pos.service');
const { InventoryService } = require('../src/services/inventoryService');

test('complete POS session: open, sale, return, cash out, close', async () => {
    const db = initDB();
    const admin = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
    const inventory = new InventoryService(db);
    const pos = new POSService(db);
    const productId = Number(db.prepare(`
        INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level)
        VALUES ('Session Meal', 'POS-SESSION-1', 'FINISHED_GOOD', 10, 3, 0, 0)
    `).run().lastInsertRowid);
    inventory.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 3, referenceId: 'OPEN-POS' });

    const session = pos.openSession({ userId: admin.id, branchId: 1, openingCash: 100 });
    const sale = pos.createOrder({
        sessionId: session.id,
        items: [{ productId, quantity: 1 }],
        paymentMethod: 'CASH'
    }, admin.id);
    const line = db.prepare('SELECT id FROM order_lines WHERE order_id = ?').get(sale.orderId);
    const returned = await pos.createReturn({
        orderId: sale.orderId,
        sessionId: session.id,
        reason: 'Customer changed order',
        items: [{ orderLineId: line.id, quantity: 1 }]
    }, admin.id);
    await pos.cashOut({ sessionId: session.id, amount: 3, reason: 'Petty cash', method: 'CASH' }, admin.id);

    const stats = pos.getSessionStats(session.id);
    assert.equal(stats.openingCash, 100);
    assert.equal(stats.cashOut, 3);
    assert.equal(stats.totalReturns, returned.totalRefund);

    const closed = await pos.closeSession({
        sessionId: session.id,
        closingCash: stats.expectedCash,
        userId: admin.id
    });
    assert.equal(closed.cashDifference, 0);
    assert.equal(db.prepare('SELECT status FROM pos_sessions WHERE id = ?').get(session.id).status, 'CLOSED');
    db.close();
});

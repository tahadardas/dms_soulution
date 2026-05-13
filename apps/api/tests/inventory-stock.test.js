const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { InventoryService } = require('../src/services/inventoryService');
const { POSService } = require('../src/services/pos.service');

const createDb = () => {
    const db = initDB();
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    return { db, admin };
};

const createProduct = (db, name, sku, type = 'RAW_MATERIAL', cost = 0, price = 0) => {
    return Number(db.prepare(`
        INSERT INTO products (name, sku, type, price, cost, stock_quantity, min_stock_level)
        VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(name, sku, type, price, cost).lastInsertRowid);
};

test('stockIn creates stock row, WAC, and movement', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Flour', 'INV-FLOUR-1');

    service.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 5, referenceId: 'PO-1' });

    const level = service.getStockLevel({ branchId: 1, productId });
    assert.equal(level.quantityOnHand, 10);
    assert.equal(level.averageCost, 5);
    const movement = db.prepare("SELECT type, quantity, unit_cost FROM inventory_movements WHERE reference_id = 'PO-1'").get();
    assert.equal(movement.type, 'IN');
    assert.equal(movement.quantity, 10);
    assert.equal(movement.unit_cost, 5);
    db.close();
});

test('weighted average cost updates on stockIn', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Sugar', 'INV-SUGAR-1');

    service.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 5, referenceId: 'PO-1' });
    service.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 7, referenceId: 'PO-2' });

    const level = service.getStockLevel({ branchId: 1, productId });
    assert.equal(level.quantityOnHand, 20);
    assert.equal(level.averageCost, 6);
    db.close();
});

test('stockOut reduces quantity, preserves WAC, and returns issued cost', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Milk', 'INV-MILK-1');

    service.stockIn({ branchId: 1, productId, quantity: 20, unitCost: 6, referenceId: 'PO-1' });
    const out = service.stockOut({ branchId: 1, productId, quantity: 5, type: 'SALE', referenceId: 'ORD-1' });

    const level = service.getStockLevel({ branchId: 1, productId });
    assert.equal(level.quantityOnHand, 15);
    assert.equal(level.averageCost, 6);
    assert.equal(out.issuedCost, 30);
    db.close();
});

test('negative stock is blocked by default without creating movement', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Beans', 'INV-BEANS-1');

    service.stockIn({ branchId: 1, productId, quantity: 3, unitCost: 2, referenceId: 'PO-1' });
    assert.throws(
        () => service.stockOut({ branchId: 1, productId, quantity: 5, type: 'SALE', referenceId: 'ORD-1' }),
        /Insufficient stock/
    );

    const level = service.getStockLevel({ branchId: 1, productId });
    assert.equal(level.quantityOnHand, 3);
    const saleMovements = db.prepare("SELECT count(*) as count FROM inventory_movements WHERE type = 'SALE'").get();
    assert.equal(saleMovements.count, 0);
    db.close();
});

test('negative stock can be allowed explicitly', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Cups', 'INV-CUPS-1');

    service.stockIn({ branchId: 1, productId, quantity: 3, unitCost: 1, referenceId: 'PO-1' });
    service.stockOut({ branchId: 1, productId, quantity: 5, type: 'SALE', referenceId: 'ORD-1', allowNegativeStock: true });

    const level = service.getStockLevel({ branchId: 1, productId });
    assert.equal(level.quantityOnHand, -2);
    const saleMovements = db.prepare("SELECT count(*) as count FROM inventory_movements WHERE type = 'SALE'").get();
    assert.equal(saleMovements.count, 1);
    db.close();
});

test('transfer creates out and in movements with same reference and WAC', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Rice', 'INV-RICE-1');
    const branch2 = Number(db.prepare('INSERT INTO branches (name, settings) VALUES (?, ?)').run('Second Branch', '{}').lastInsertRowid);

    service.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 4, referenceId: 'PO-1' });
    const transfer = service.transferStock({
        fromBranchId: 1,
        toBranchId: branch2,
        items: [{ productId, quantity: 4 }],
        reason: 'Branch transfer',
        referenceId: 'TR-1'
    });

    assert.equal(transfer.reference_id, 'TR-1');
    assert.equal(service.getStockLevel({ branchId: 1, productId }).quantityOnHand, 6);
    const destination = service.getStockLevel({ branchId: branch2, productId });
    assert.equal(destination.quantityOnHand, 4);
    assert.equal(destination.averageCost, 4);
    const movementCount = db.prepare("SELECT count(*) as count FROM inventory_movements WHERE reference_id = 'TR-1'").get();
    assert.equal(movementCount.count, 2);
    db.close();
});

test('transfer to same branch is rejected', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Oil', 'INV-OIL-1');

    service.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 4, referenceId: 'PO-1' });
    assert.throws(
        () => service.transferStock({
            fromBranchId: 1,
            toBranchId: 1,
            items: [{ productId, quantity: 1 }],
            reason: 'Invalid transfer'
        }),
        /different source and destination/
    );
    db.close();
});

test('recipe consumption deducts components and returns component COGS', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const doughId = createProduct(db, 'Dough', 'INV-DOUGH-1');
    const cheeseId = createProduct(db, 'Cheese', 'INV-CHEESE-1');
    const pizzaId = createProduct(db, 'Pizza', 'INV-PIZZA-1', 'FINISHED_GOOD', 0, 12);

    db.prepare('INSERT INTO recipes (product_id, ingredient_id, quantity, waste_percent) VALUES (?, ?, ?, ?)').run(pizzaId, doughId, 1, 0);
    db.prepare('INSERT INTO recipes (product_id, ingredient_id, quantity, waste_percent) VALUES (?, ?, ?, ?)').run(pizzaId, cheeseId, 0.2, 0);
    service.stockIn({ branchId: 1, productId: doughId, quantity: 10, unitCost: 1, referenceId: 'PO-DOUGH' });
    service.stockIn({ branchId: 1, productId: cheeseId, quantity: 5, unitCost: 10, referenceId: 'PO-CHEESE' });

    const result = service.consumeRecipe({ branchId: 1, productId: pizzaId, quantity: 2, referenceId: 'ORD-PIZZA' });

    assert.equal(service.getStockLevel({ branchId: 1, productId: doughId }).quantityOnHand, 8);
    assert.equal(service.getStockLevel({ branchId: 1, productId: cheeseId }).quantityOnHand, 4.6);
    assert.equal(result.totalCost, 6);
    const movementCount = db.prepare("SELECT count(*) as count FROM inventory_movements WHERE type = 'RECIPE_CONSUMPTION'").get();
    assert.equal(movementCount.count, 2);
    db.close();
});

test('returnStock restores non-recipe stock and creates RETURN movement', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Juice', 'INV-JUICE-1');

    service.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 4, referenceId: 'PO-1' });
    service.stockOut({ branchId: 1, productId, quantity: 3, type: 'SALE', referenceId: 'ORD-1' });
    service.returnStock({ branchId: 1, productId, quantity: 1, unitCost: 4, referenceId: 'RET-1' });

    assert.equal(service.getStockLevel({ branchId: 1, productId }).quantityOnHand, 8);
    const movement = db.prepare("SELECT type, quantity FROM inventory_movements WHERE reference_id = 'RET-1'").get();
    assert.equal(movement.type, 'RETURN');
    assert.equal(movement.quantity, 1);
    db.close();
});

test('rebuildStockSnapshot recalculates stock from movements', () => {
    const { db } = createDb();
    const service = new InventoryService(db);
    const productId = createProduct(db, 'Water', 'INV-WATER-1');

    service.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 2, referenceId: 'PO-1' });
    service.stockOut({ branchId: 1, productId, quantity: 4, type: 'SALE', referenceId: 'ORD-1' });
    db.prepare('UPDATE inventory_stock SET quantity_on_hand = 999 WHERE product_id = ?').run(productId);

    const result = service.rebuildStockSnapshot();

    assert.ok(result.rebuiltRows >= 1);
    assert.equal(service.getStockLevel({ branchId: 1, productId }).quantityOnHand, 6);
    assert.equal(service.getStockLevel({ branchId: 1, productId }).averageCost, 2);
    db.close();
});

test('POS order rolls back order, movement, and stock when accounting fails', () => {
    const { db, admin } = createDb();
    const inventoryService = new InventoryService(db);
    const posService = new POSService(db);
    const productId = createProduct(db, 'Rollback Item', 'INV-ROLLBACK-1', 'FINISHED_GOOD', 2, 5);

    inventoryService.stockIn({ branchId: 1, productId, quantity: 10, unitCost: 2, referenceId: 'PO-ROLLBACK' });
    const accounting = JSON.parse(db.prepare("SELECT value FROM settings WHERE key = 'accounting'").get().value);
    accounting.chartOfAccountsMapping.revenue = '9999';
    db.prepare("UPDATE settings SET value = ? WHERE key = 'accounting'").run(JSON.stringify(accounting));

    const session = posService.openSession({ userId: admin.id, branchId: 1, openingCash: 0 });
    assert.throws(
        () => posService.createOrder({
            sessionId: session.id,
            items: [{ productId, quantity: 2 }]
        }, admin.id),
        /Account not found/
    );

    assert.equal(db.prepare('SELECT count(*) as count FROM orders').get().count, 0);
    assert.equal(db.prepare("SELECT count(*) as count FROM inventory_movements WHERE type = 'SALE'").get().count, 0);
    assert.equal(inventoryService.getStockLevel({ branchId: 1, productId }).quantityOnHand, 10);
    db.close();
});

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { InventoryService } = require('../src/services/inventoryService');

const createDb = () => {
    const db = initDB();
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    return { db, admin };
};

test('products CRUD with categories, units, and recipes', () => {
    const { db, admin } = createDb();
    const inventoryService = new InventoryService(db);

    const category = inventoryService.createCategory({ name: 'Food', description: 'Food items' }, admin.id);
    const unit = inventoryService.createUnit({ name: 'Test Piece', abbreviation: 'tpc' }, admin.id);

    const ingredient = inventoryService.createProduct({
        name: 'Bun',
        sku: 'BUN-001',
        type: 'RAW_MATERIAL',
        price: 0.5,
        category_id: category.id,
        unit_id: unit.id,
        is_active: 1
    }, admin.id);

    const product = inventoryService.createProduct({
        name: 'Burger',
        sku: 'BRG-001',
        type: 'FINISHED_GOOD',
        price: 8.5,
        category_id: category.id,
        unit_id: unit.id,
        is_active: 1
    }, admin.id);

    inventoryService.replaceRecipe(Number(product.id), [{
        ingredient_id: Number(ingredient.id),
        quantity: 2,
        unit_id: unit.id,
        waste_percent: 5,
        notes: 'Toasted'
    }], admin.id);

    const recipe = inventoryService.getRecipe(Number(product.id));
    assert.equal(recipe.length, 1);
    assert.equal(recipe[0].ingredient_id, ingredient.id);

    const updated = inventoryService.updateProduct(Number(product.id), {
        name: 'Burger Deluxe',
        price: 9.25,
        is_active: false
    }, admin.id);
    assert.equal(updated.name, 'Burger Deluxe');
    assert.equal(updated.is_active, 0);

    const list = inventoryService.getProducts({
        search: 'Burger',
        categoryId: Number(category.id),
        isActive: false,
        page: 1,
        pageSize: 10
    });
    assert.equal(list.total, 1);

    db.close();
});

test('unit conversions can be upserted and listed', () => {
    const { db, admin } = createDb();
    const inventoryService = new InventoryService(db);

    const piece = inventoryService.createUnit({ name: 'Test Piece', abbreviation: 'tpc' }, admin.id);
    const box = inventoryService.createUnit({ name: 'Test Box', abbreviation: 'tbox' }, admin.id);

    inventoryService.upsertUnitConversion({
        from_unit_id: piece.id,
        to_unit_id: box.id,
        multiplier: 12
    }, admin.id);

    const conversions = inventoryService.listUnitConversions();
    assert.ok(conversions.length >= 1);
    const conversion = conversions.find(row => row.from_unit_id === piece.id && row.to_unit_id === box.id);
    assert.ok(conversion);

    db.close();
});

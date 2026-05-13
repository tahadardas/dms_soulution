const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DMS_DB_PATH = ':memory:';

const { initDB } = require('../src/database');
const { InventoryService } = require('../src/services/inventoryService');
const { SettingsService } = require('../src/services/settingsService');

test('FIFO setting is rejected instead of silently using weighted average', () => {
    const db = initDB();
    const settings = new SettingsService(db);

    assert.throws(() => settings.updateSettings('inventory', {
        valuationMethod: 'FIFO',
        defaultUnit: 'Unit',
        lowStockThresholdGlobal: 10,
        autoDeductStockOnSale: true,
        allowNegativeStock: false,
        quantityPrecision: 2,
        unitConversionPolicy: 'STRICT'
    }, 1), /FIFO valuation is not implemented/i);

    db.close();
});

test('purchase by carton stores base quantity in pieces', () => {
    const db = initDB();
    const service = new InventoryService(db);
    const piece = service.createUnit({ name: 'Piece Test', abbreviation: 'pc-t' }, 1);
    const carton = service.createUnit({ name: 'Carton Test', abbreviation: 'ctn-t' }, 1);
    service.upsertUnitConversion({ from_unit_id: carton.id, to_unit_id: piece.id, multiplier: 12 }, 1);
    const product = service.createProduct({
        name: 'Arabic Tea شاي',
        sku: 'UNIT-TEA-1',
        type: 'RAW_MATERIAL',
        price: 0,
        unit_id: piece.id,
        base_unit_id: piece.id
    }, 1);

    service.stockIn({
        branchId: 1,
        productId: Number(product.id),
        quantity: 2,
        unitCost: 3,
        referenceId: 'PO-CARTON',
        enteredUnitId: carton.id,
        enteredQuantity: 2
    });

    const level = service.getStockLevel({ branchId: 1, productId: Number(product.id) });
    assert.equal(level.quantityOnHand, 24);
    const movement = db.prepare("SELECT entered_quantity, entered_unit_id, base_quantity FROM inventory_movements WHERE reference_id = 'PO-CARTON'").get();
    assert.equal(movement.entered_quantity, 2);
    assert.equal(movement.entered_unit_id, carton.id);
    assert.equal(movement.base_quantity, 24);
    db.close();
});

test('missing unit conversion is blocked', () => {
    const db = initDB();
    const service = new InventoryService(db);
    const piece = service.createUnit({ name: 'Piece Missing', abbreviation: 'pcm' }, 1);
    const box = service.createUnit({ name: 'Box Missing', abbreviation: 'boxm' }, 1);
    const product = service.createProduct({
        name: 'No Conversion',
        sku: 'NO-CONV-1',
        type: 'RAW_MATERIAL',
        price: 0,
        unit_id: piece.id,
        base_unit_id: piece.id
    }, 1);

    assert.throws(() => service.stockIn({
        branchId: 1,
        productId: Number(product.id),
        quantity: 1,
        unitCost: 1,
        enteredUnitId: box.id,
        enteredQuantity: 1
    }), /Missing unit conversion/i);
    db.close();
});

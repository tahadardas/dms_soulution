"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryMovementSchema = exports.InventoryMovementTypeEnum = exports.ProductRecipeSchema = exports.RecipeItemSchema = exports.ProductSchema = exports.ProductTypeEnum = void 0;
const zod_1 = require("zod");
exports.ProductTypeEnum = zod_1.z.enum(['RAW_MATERIAL', 'FINISHED_GOOD', 'SERVICE']);
exports.ProductSchema = zod_1.z.object({
    id: zod_1.z.number().optional(),
    name: zod_1.z.string(),
    sku: zod_1.z.string(),
    type: exports.ProductTypeEnum,
    price: zod_1.z.number().min(0),
    cost: zod_1.z.number().min(0).default(0), // Weighted Average Cost
    stock_quantity: zod_1.z.number().default(0),
    min_stock_level: zod_1.z.number().optional(),
});
exports.RecipeItemSchema = zod_1.z.object({
    ingredient_id: zod_1.z.number(),
    quantity: zod_1.z.number().min(0.0001),
});
exports.ProductRecipeSchema = zod_1.z.object({
    product_id: zod_1.z.number(),
    items: zod_1.z.array(exports.RecipeItemSchema),
});
exports.InventoryMovementTypeEnum = zod_1.z.enum(['IN', 'OUT', 'TRANSFER', 'ADJUST', 'SALE', 'RETURN']);
exports.InventoryMovementSchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    date: zod_1.z.string(), // ISO
    type: exports.InventoryMovementTypeEnum,
    product_id: zod_1.z.number(),
    quantity: zod_1.z.number(), // Positive for IN, Negative for OUT usually handled by logic, but here absolute qty + type
    unit_cost: zod_1.z.number().optional(), // For IN
    reference_id: zod_1.z.string().optional(), // PO number or Order ID
    description: zod_1.z.string().optional(),
});
//# sourceMappingURL=inventory.js.map
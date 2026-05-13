import { z } from 'zod';

export const ProductTypeEnum = z.enum(['RAW_MATERIAL', 'FINISHED_GOOD', 'SERVICE']);
export type ProductType = z.infer<typeof ProductTypeEnum>;

export const ProductSchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    sku: z.string(),
    description: z.string().optional(),
    type: ProductTypeEnum,
    price: z.number().min(0),
    cost: z.number().min(0).default(0), // Weighted Average Cost
    stock_quantity: z.number().default(0),
    min_stock_level: z.number().optional(),
    category_id: z.number().nullable().optional(),
    unit_id: z.number().nullable().optional(),
    base_unit_id: z.number().nullable().optional(),
    is_active: z.boolean().default(true),
    created_by: z.number().nullable().optional(),
    created_at: z.string().optional(),
    updated_by: z.number().nullable().optional(),
    updated_at: z.string().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const RecipeItemSchema = z.object({
    ingredient_id: z.number(),
    quantity: z.number().min(0.0001),
    unit_id: z.number().nullable().optional(),
    waste_percent: z.number().min(0).max(100).optional(),
    notes: z.string().optional(),
});

export type RecipeItem = z.infer<typeof RecipeItemSchema>;

export const ProductRecipeSchema = z.object({
    product_id: z.number(),
    items: z.array(RecipeItemSchema),
});

export type ProductRecipe = z.infer<typeof ProductRecipeSchema>;

export const CategorySchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    description: z.string().optional(),
    is_active: z.boolean().default(true),
    created_by: z.number().nullable().optional(),
    created_at: z.string().optional(),
    updated_by: z.number().nullable().optional(),
    updated_at: z.string().optional(),
});

export type Category = z.infer<typeof CategorySchema>;

export const UnitSchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    abbreviation: z.string(),
    is_active: z.boolean().default(true),
    created_by: z.number().nullable().optional(),
    created_at: z.string().optional(),
    updated_by: z.number().nullable().optional(),
    updated_at: z.string().optional(),
});

export type Unit = z.infer<typeof UnitSchema>;

export const UnitConversionSchema = z.object({
    id: z.number().optional(),
    from_unit_id: z.number(),
    to_unit_id: z.number(),
    multiplier: z.number().min(0.000001),
    created_by: z.number().nullable().optional(),
    created_at: z.string().optional(),
    updated_by: z.number().nullable().optional(),
    updated_at: z.string().optional(),
});

export type UnitConversion = z.infer<typeof UnitConversionSchema>;

export const InventoryMovementTypeEnum = z.enum([
    'IN',
    'OUT',
    'ADJUST',
    'ADJUSTMENT',
    'PURCHASE',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'SALE',
    'RETURN',
    'RECIPE_CONSUMPTION',
    'OPENING_BALANCE'
]);

export const InventoryMovementSchema = z.object({
    id: z.string().optional(),
    date: z.string(), // ISO
    type: InventoryMovementTypeEnum,
    product_id: z.number(),
    quantity: z.number(), // Positive for IN, Negative for OUT usually handled by logic, but here absolute qty + type
    unit_cost: z.number().optional(), // For IN
    reference_id: z.string().optional(), // PO number or Order ID
    source_type: z.string().optional(),
    entered_unit_id: z.number().nullable().optional(),
    entered_quantity: z.number().optional(),
    base_quantity: z.number().optional(),
    description: z.string().optional(),
    branch_id: z.number().nullable().optional(),
    reason: z.string().optional(),
    created_by: z.number().nullable().optional(),
});

export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;

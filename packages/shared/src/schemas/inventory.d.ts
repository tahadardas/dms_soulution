import { z } from 'zod';
export declare const ProductTypeEnum: z.ZodEnum<["RAW_MATERIAL", "FINISHED_GOOD", "SERVICE"]>;
export type ProductType = z.infer<typeof ProductTypeEnum>;
export declare const ProductSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    name: z.ZodString;
    sku: z.ZodString;
    type: z.ZodEnum<["RAW_MATERIAL", "FINISHED_GOOD", "SERVICE"]>;
    price: z.ZodNumber;
    cost: z.ZodDefault<z.ZodNumber>;
    stock_quantity: z.ZodDefault<z.ZodNumber>;
    min_stock_level: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: "RAW_MATERIAL" | "FINISHED_GOOD" | "SERVICE";
    name: string;
    cost: number;
    sku: string;
    price: number;
    stock_quantity: number;
    id?: number | undefined;
    min_stock_level?: number | undefined;
}, {
    type: "RAW_MATERIAL" | "FINISHED_GOOD" | "SERVICE";
    name: string;
    sku: string;
    price: number;
    id?: number | undefined;
    cost?: number | undefined;
    stock_quantity?: number | undefined;
    min_stock_level?: number | undefined;
}>;
export type Product = z.infer<typeof ProductSchema>;
export declare const RecipeItemSchema: z.ZodObject<{
    ingredient_id: z.ZodNumber;
    quantity: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    ingredient_id: number;
}, {
    quantity: number;
    ingredient_id: number;
}>;
export type RecipeItem = z.infer<typeof RecipeItemSchema>;
export declare const ProductRecipeSchema: z.ZodObject<{
    product_id: z.ZodNumber;
    items: z.ZodArray<z.ZodObject<{
        ingredient_id: z.ZodNumber;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        ingredient_id: number;
    }, {
        quantity: number;
        ingredient_id: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    product_id: number;
    items: {
        quantity: number;
        ingredient_id: number;
    }[];
}, {
    product_id: number;
    items: {
        quantity: number;
        ingredient_id: number;
    }[];
}>;
export type ProductRecipe = z.infer<typeof ProductRecipeSchema>;
export declare const InventoryMovementTypeEnum: z.ZodEnum<["IN", "OUT", "TRANSFER", "ADJUST", "SALE", "RETURN"]>;
export declare const InventoryMovementSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    type: z.ZodEnum<["IN", "OUT", "TRANSFER", "ADJUST", "SALE", "RETURN"]>;
    product_id: z.ZodNumber;
    quantity: z.ZodNumber;
    unit_cost: z.ZodOptional<z.ZodNumber>;
    reference_id: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "IN" | "OUT" | "TRANSFER" | "ADJUST" | "SALE" | "RETURN";
    date: string;
    quantity: number;
    product_id: number;
    id?: string | undefined;
    description?: string | undefined;
    unit_cost?: number | undefined;
    reference_id?: string | undefined;
}, {
    type: "IN" | "OUT" | "TRANSFER" | "ADJUST" | "SALE" | "RETURN";
    date: string;
    quantity: number;
    product_id: number;
    id?: string | undefined;
    description?: string | undefined;
    unit_cost?: number | undefined;
    reference_id?: string | undefined;
}>;
export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;
//# sourceMappingURL=inventory.d.ts.map
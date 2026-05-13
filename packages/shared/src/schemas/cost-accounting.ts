import { z } from 'zod';
import { IDSchema, DateRangeSchema } from './common';

// Cost Classification
export const CostClassificationSchema = z.enum(['DIRECT', 'INDIRECT']);
export const CostBehaviorSchema = z.enum(['FIXED', 'VARIABLE']);

export const CostTypeSchema = z.object({
    id: IDSchema,
    name: z.string(),
    classification: CostClassificationSchema,
    behavior: CostBehaviorSchema,
    description: z.string().optional(),
});
export type CostType = z.infer<typeof CostTypeSchema>;

// Cost Centers
export const CostCenterTypeSchema = z.enum(['PROFIT', 'COST', 'REVENUE', 'INVESTMENT']);

export const CostCenterSchema = z.object({
    id: IDSchema,
    name: z.string(), // e.g., 'Kitchen', 'Delivery', 'Admin'
    code: z.string(),
    type: CostCenterTypeSchema.default('COST'),
    description: z.string().optional(),
});
export type CostCenter = z.infer<typeof CostCenterSchema>;

// Allocation Rules
export const AllocationMethodSchema = z.enum(['PERCENTAGE', 'ACTIVITY', 'SALES', 'UNITS']);

export const AllocationRuleSchema = z.object({
    id: IDSchema,
    sourceCostCenterId: IDSchema,
    targetCostCenterId: IDSchema.optional(), // If null, maybe targets a specific product category?
    targetProductCategoryId: IDSchema.optional(),

    method: AllocationMethodSchema,
    factor: z.number().min(0).optional(), // usage depends on method. For PERCENTAGE: 0-100.

    description: z.string().optional(),
    isActive: z.boolean().default(true),
});
export type AllocationRule = z.infer<typeof AllocationRuleSchema>;

// Allocation Execution Results
export const CostAllocationResultSchema = z.object({
    id: IDSchema,
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    sourceCostCenterId: IDSchema,
    targetCostCenterId: IDSchema.nullable().optional(),
    amountAllocated: z.number(),
    methodUsed: AllocationMethodSchema,
    runAt: z.string().datetime(),
});

// Unit Cost & Margins
export const ProductUnitCostSchema = z.object({
    productId: IDSchema,
    productName: z.string(),
    period: z.string(), // '2023-10'

    materialCost: z.number().min(0), // Direct Material
    laborCost: z.number().min(0),    // Direct Labor (allocated or direct)
    overheadCost: z.number().min(0), // Allocated Overhead

    totalUnitCost: z.number().min(0),
});
export type ProductUnitCost = z.infer<typeof ProductUnitCostSchema>;

// KPIs
export const CostKPIsSchema = z.object({
    period: z.string(),
    grossMargin: z.number(),         // Rev - COGS
    netMargin: z.number(),           // Rev - Total Cost
    grossMarginPercent: z.number(),
    netMarginPercent: z.number(),
    totalFixedCost: z.number(),
    totalVariableCost: z.number(),
    breakevenPoint: z.number().optional(),
});
export type CostKPIs = z.infer<typeof CostKPIsSchema>;

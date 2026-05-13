import { z } from 'zod';
export declare const CostClassificationSchema: z.ZodEnum<["DIRECT", "INDIRECT"]>;
export declare const CostBehaviorSchema: z.ZodEnum<["FIXED", "VARIABLE"]>;
export declare const CostTypeSchema: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    name: z.ZodString;
    classification: z.ZodEnum<["DIRECT", "INDIRECT"]>;
    behavior: z.ZodEnum<["FIXED", "VARIABLE"]>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string | number;
    name: string;
    classification: "DIRECT" | "INDIRECT";
    behavior: "FIXED" | "VARIABLE";
    description?: string | undefined;
}, {
    id: string | number;
    name: string;
    classification: "DIRECT" | "INDIRECT";
    behavior: "FIXED" | "VARIABLE";
    description?: string | undefined;
}>;
export type CostType = z.infer<typeof CostTypeSchema>;
export declare const CostCenterTypeSchema: z.ZodEnum<["PROFIT", "COST", "REVENUE", "INVESTMENT"]>;
export declare const CostCenterSchema: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    name: z.ZodString;
    code: z.ZodString;
    type: z.ZodDefault<z.ZodEnum<["PROFIT", "COST", "REVENUE", "INVESTMENT"]>>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "REVENUE" | "PROFIT" | "COST" | "INVESTMENT";
    code: string;
    id: string | number;
    name: string;
    description?: string | undefined;
}, {
    code: string;
    id: string | number;
    name: string;
    type?: "REVENUE" | "PROFIT" | "COST" | "INVESTMENT" | undefined;
    description?: string | undefined;
}>;
export type CostCenter = z.infer<typeof CostCenterSchema>;
export declare const AllocationMethodSchema: z.ZodEnum<["PERCENTAGE", "ACTIVITY", "SALES", "UNITS"]>;
export declare const AllocationRuleSchema: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    sourceCostCenterId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    targetCostCenterId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    targetProductCategoryId: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
    method: z.ZodEnum<["PERCENTAGE", "ACTIVITY", "SALES", "UNITS"]>;
    factor: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    id: string | number;
    sourceCostCenterId: string | number;
    method: "PERCENTAGE" | "ACTIVITY" | "SALES" | "UNITS";
    isActive: boolean;
    description?: string | undefined;
    targetCostCenterId?: string | number | undefined;
    targetProductCategoryId?: string | number | undefined;
    factor?: number | undefined;
}, {
    id: string | number;
    sourceCostCenterId: string | number;
    method: "PERCENTAGE" | "ACTIVITY" | "SALES" | "UNITS";
    description?: string | undefined;
    targetCostCenterId?: string | number | undefined;
    targetProductCategoryId?: string | number | undefined;
    factor?: number | undefined;
    isActive?: boolean | undefined;
}>;
export type AllocationRule = z.infer<typeof AllocationRuleSchema>;
export declare const CostAllocationResultSchema: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    periodStart: z.ZodString;
    periodEnd: z.ZodString;
    sourceCostCenterId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    targetCostCenterId: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
    amountAllocated: z.ZodNumber;
    methodUsed: z.ZodEnum<["PERCENTAGE", "ACTIVITY", "SALES", "UNITS"]>;
    runAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string | number;
    sourceCostCenterId: string | number;
    periodStart: string;
    periodEnd: string;
    amountAllocated: number;
    methodUsed: "PERCENTAGE" | "ACTIVITY" | "SALES" | "UNITS";
    runAt: string;
    targetCostCenterId?: string | number | null | undefined;
}, {
    id: string | number;
    sourceCostCenterId: string | number;
    periodStart: string;
    periodEnd: string;
    amountAllocated: number;
    methodUsed: "PERCENTAGE" | "ACTIVITY" | "SALES" | "UNITS";
    runAt: string;
    targetCostCenterId?: string | number | null | undefined;
}>;
export declare const ProductUnitCostSchema: z.ZodObject<{
    productId: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
    productName: z.ZodString;
    period: z.ZodString;
    materialCost: z.ZodNumber;
    laborCost: z.ZodNumber;
    overheadCost: z.ZodNumber;
    totalUnitCost: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    productId: string | number;
    productName: string;
    period: string;
    materialCost: number;
    laborCost: number;
    overheadCost: number;
    totalUnitCost: number;
}, {
    productId: string | number;
    productName: string;
    period: string;
    materialCost: number;
    laborCost: number;
    overheadCost: number;
    totalUnitCost: number;
}>;
export type ProductUnitCost = z.infer<typeof ProductUnitCostSchema>;
export declare const CostKPIsSchema: z.ZodObject<{
    period: z.ZodString;
    grossMargin: z.ZodNumber;
    netMargin: z.ZodNumber;
    grossMarginPercent: z.ZodNumber;
    netMarginPercent: z.ZodNumber;
    totalFixedCost: z.ZodNumber;
    totalVariableCost: z.ZodNumber;
    breakevenPoint: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    grossMargin: number;
    period: string;
    netMargin: number;
    grossMarginPercent: number;
    netMarginPercent: number;
    totalFixedCost: number;
    totalVariableCost: number;
    breakevenPoint?: number | undefined;
}, {
    grossMargin: number;
    period: string;
    netMargin: number;
    grossMarginPercent: number;
    netMarginPercent: number;
    totalFixedCost: number;
    totalVariableCost: number;
    breakevenPoint?: number | undefined;
}>;
export type CostKPIs = z.infer<typeof CostKPIsSchema>;
//# sourceMappingURL=cost-accounting.d.ts.map
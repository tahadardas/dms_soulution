"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostKPIsSchema = exports.ProductUnitCostSchema = exports.CostAllocationResultSchema = exports.AllocationRuleSchema = exports.AllocationMethodSchema = exports.CostCenterSchema = exports.CostCenterTypeSchema = exports.CostTypeSchema = exports.CostBehaviorSchema = exports.CostClassificationSchema = void 0;
const zod_1 = require("zod");
const common_1 = require("./common");
// Cost Classification
exports.CostClassificationSchema = zod_1.z.enum(['DIRECT', 'INDIRECT']);
exports.CostBehaviorSchema = zod_1.z.enum(['FIXED', 'VARIABLE']);
exports.CostTypeSchema = zod_1.z.object({
    id: common_1.IDSchema,
    name: zod_1.z.string(),
    classification: exports.CostClassificationSchema,
    behavior: exports.CostBehaviorSchema,
    description: zod_1.z.string().optional(),
});
// Cost Centers
exports.CostCenterTypeSchema = zod_1.z.enum(['PROFIT', 'COST', 'REVENUE', 'INVESTMENT']);
exports.CostCenterSchema = zod_1.z.object({
    id: common_1.IDSchema,
    name: zod_1.z.string(), // e.g., 'Kitchen', 'Delivery', 'Admin'
    code: zod_1.z.string(),
    type: exports.CostCenterTypeSchema.default('COST'),
    description: zod_1.z.string().optional(),
});
// Allocation Rules
exports.AllocationMethodSchema = zod_1.z.enum(['PERCENTAGE', 'ACTIVITY', 'SALES', 'UNITS']);
exports.AllocationRuleSchema = zod_1.z.object({
    id: common_1.IDSchema,
    sourceCostCenterId: common_1.IDSchema,
    targetCostCenterId: common_1.IDSchema.optional(), // If null, maybe targets a specific product category?
    targetProductCategoryId: common_1.IDSchema.optional(),
    method: exports.AllocationMethodSchema,
    factor: zod_1.z.number().min(0).optional(), // usage depends on method. For PERCENTAGE: 0-100.
    description: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().default(true),
});
// Allocation Execution Results
exports.CostAllocationResultSchema = zod_1.z.object({
    id: common_1.IDSchema,
    periodStart: zod_1.z.string().datetime(),
    periodEnd: zod_1.z.string().datetime(),
    sourceCostCenterId: common_1.IDSchema,
    targetCostCenterId: common_1.IDSchema.nullable().optional(),
    amountAllocated: zod_1.z.number(),
    methodUsed: exports.AllocationMethodSchema,
    runAt: zod_1.z.string().datetime(),
});
// Unit Cost & Margins
exports.ProductUnitCostSchema = zod_1.z.object({
    productId: common_1.IDSchema,
    productName: zod_1.z.string(),
    period: zod_1.z.string(), // '2023-10'
    materialCost: zod_1.z.number().min(0), // Direct Material
    laborCost: zod_1.z.number().min(0), // Direct Labor (allocated or direct)
    overheadCost: zod_1.z.number().min(0), // Allocated Overhead
    totalUnitCost: zod_1.z.number().min(0),
});
// KPIs
exports.CostKPIsSchema = zod_1.z.object({
    period: zod_1.z.string(),
    grossMargin: zod_1.z.number(), // Rev - COGS
    netMargin: zod_1.z.number(), // Rev - Total Cost
    grossMarginPercent: zod_1.z.number(),
    netMarginPercent: zod_1.z.number(),
    totalFixedCost: zod_1.z.number(),
    totalVariableCost: zod_1.z.number(),
    breakevenPoint: zod_1.z.number().optional(),
});
//# sourceMappingURL=cost-accounting.js.map
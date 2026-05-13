"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerReportItemSchema = exports.SalesReportItemSchema = exports.DashboardStatsSchema = void 0;
const zod_1 = require("zod");
exports.DashboardStatsSchema = zod_1.z.object({
    totalSales: zod_1.z.number(),
    totalOrders: zod_1.z.number(),
    averageOrderValue: zod_1.z.number(),
    totalCOGS: zod_1.z.number(),
    grossMargin: zod_1.z.number(),
    lowStockCount: zod_1.z.number(),
});
exports.SalesReportItemSchema = zod_1.z.object({
    date: zod_1.z.string().optional(), // Period (Day/Month)
    itemName: zod_1.z.string().optional(),
    quantity: zod_1.z.number(),
    revenue: zod_1.z.number(),
    cost: zod_1.z.number(),
    margin: zod_1.z.number(),
});
exports.LedgerReportItemSchema = zod_1.z.object({
    date: zod_1.z.string(),
    description: zod_1.z.string(),
    accountName: zod_1.z.string(),
    debit: zod_1.z.number(),
    credit: zod_1.z.number(),
    referenceId: zod_1.z.string().optional(),
    sourceType: zod_1.z.string(),
});
//# sourceMappingURL=reports.js.map
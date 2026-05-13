import { z } from 'zod';
export declare const DashboardStatsSchema: z.ZodObject<{
    totalSales: z.ZodNumber;
    totalOrders: z.ZodNumber;
    averageOrderValue: z.ZodNumber;
    totalCOGS: z.ZodNumber;
    grossMargin: z.ZodNumber;
    lowStockCount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    totalCOGS: number;
    grossMargin: number;
    lowStockCount: number;
}, {
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    totalCOGS: number;
    grossMargin: number;
    lowStockCount: number;
}>;
export type DashboardStats = z.infer<typeof DashboardStatsSchema>;
export declare const SalesReportItemSchema: z.ZodObject<{
    date: z.ZodOptional<z.ZodString>;
    itemName: z.ZodOptional<z.ZodString>;
    quantity: z.ZodNumber;
    revenue: z.ZodNumber;
    cost: z.ZodNumber;
    margin: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    quantity: number;
    revenue: number;
    cost: number;
    margin: number;
    date?: string | undefined;
    itemName?: string | undefined;
}, {
    quantity: number;
    revenue: number;
    cost: number;
    margin: number;
    date?: string | undefined;
    itemName?: string | undefined;
}>;
export type SalesReportItem = z.infer<typeof SalesReportItemSchema>;
export declare const LedgerReportItemSchema: z.ZodObject<{
    date: z.ZodString;
    description: z.ZodString;
    accountName: z.ZodString;
    debit: z.ZodNumber;
    credit: z.ZodNumber;
    referenceId: z.ZodOptional<z.ZodString>;
    sourceType: z.ZodString;
}, "strip", z.ZodTypeAny, {
    date: string;
    debit: number;
    credit: number;
    description: string;
    accountName: string;
    sourceType: string;
    referenceId?: string | undefined;
}, {
    date: string;
    debit: number;
    credit: number;
    description: string;
    accountName: string;
    sourceType: string;
    referenceId?: string | undefined;
}>;
export type LedgerReportItem = z.infer<typeof LedgerReportItemSchema>;
//# sourceMappingURL=reports.d.ts.map
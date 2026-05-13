import { z } from 'zod';



export const DashboardStatsSchema = z.object({
    totalSales: z.number(),
    totalOrders: z.number(),
    averageOrderValue: z.number(),
    totalCOGS: z.number(),
    grossMargin: z.number(),
    lowStockCount: z.number(),
});

export type DashboardStats = z.infer<typeof DashboardStatsSchema>;

export const SalesReportItemSchema = z.object({
    date: z.string().optional(), // Period (Day/Month)
    itemName: z.string().optional(),
    quantity: z.number(),
    revenue: z.number(),
    cost: z.number(),
    margin: z.number(),
});

export type SalesReportItem = z.infer<typeof SalesReportItemSchema>;

export const LedgerReportItemSchema = z.object({
    date: z.string(),
    description: z.string(),
    accountName: z.string(),
    debit: z.number(),
    credit: z.number(),
    referenceId: z.string().optional(),
    sourceType: z.string(),
});

export type LedgerReportItem = z.infer<typeof LedgerReportItemSchema>;

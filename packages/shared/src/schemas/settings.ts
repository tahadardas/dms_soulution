import { z } from 'zod';

// --- Accounting Settings ---
export const AccountingSettingsSchema = z.object({
    chartOfAccountsMapping: z.record(z.string(), z.string()).describe('Maps logical names to account codes (e.g., "Cash" -> "1010")'),
    currencyCode: z.string().min(3).max(3).default('USD'),
    postingPolicy: z.enum(['IMMEDIATE', 'MANUAL', 'BATCH']).default('IMMEDIATE'),
    fiscalYearStartMonth: z.number().min(1).max(12).default(1),
    fiscalYearStartDay: z.number().min(1).max(28).default(1),
    fiscalPeriodType: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']).default('MONTHLY'),
    allowManualJournalEntries: z.boolean().default(true),
});

// --- Costing Settings ---
export const CostingSettingsSchema = z.object({
    defaultAllocationMethod: z.enum(['DIRECT', 'STEP_DOWN', 'RECIPROCAL']).default('DIRECT'),
    allocationBasis: z.enum(['SALES', 'UNITS', 'LABOR_HOURS']).default('SALES'),
    costCentersEnabled: z.boolean().default(false),
    defaultCostCenter: z.string().default('GENERAL'),
    costClassificationDefault: z.enum(['DIRECT', 'INDIRECT', 'OVERHEAD']).default('DIRECT'),
    autoCalculateUnitCost: z.boolean().default(true),
});

// --- Inventory Settings ---
export const InventorySettingsSchema = z.object({
    valuationMethod: z.enum(['WAC']).default('WAC'),
    defaultUnit: z.string().default('Unit'),
    lowStockThresholdGlobal: z.number().default(10),
    autoDeductStockOnSale: z.boolean().default(true),
    allowNegativeStock: z.boolean().default(false),
    quantityPrecision: z.number().min(0).max(4).default(2),
    unitConversionPolicy: z.enum(['STRICT', 'FLEXIBLE']).default('STRICT'),
});

// --- POS Settings ---
export const POSSettingsSchema = z.object({
    tablesEnabled: z.boolean().default(true),
    serviceChargePercentage: z.number().min(0).max(100).default(0),
    allowDiscounts: z.boolean().default(true),
    maxDiscountPercentage: z.number().min(0).max(100).default(100),
    discountReasonRequired: z.boolean().default(false),
    tipsEnabled: z.boolean().default(true),
    allowReturns: z.boolean().default(true),
    returnWindowMinutes: z.number().min(0).default(1440), // 24 hours
    returnReasonRequired: z.boolean().default(true),
    refundWindowMinutes: z.number().optional(),

    // Accounting Control Policies
    cashDifferenceToleranceAmount: z.number().default(0),
    cashDifferenceRequiresManager: z.boolean().default(true),
    allowCloseSessionWithPendingDelivery: z.boolean().default(false),
    pendingDeliveryCloseRequiresManager: z.boolean().default(true),
    maxCashierDiscountPercent: z.number().default(5),
    maxCashierDiscountAmount: z.number().default(0),
    managerRequiredDiscountPercent: z.number().default(5),
    managerRequiredReturnAmount: z.number().default(0),
    managerRequiredVoidAfterPayment: z.boolean().default(true),
    managerRequiredReprint: z.boolean().default(true),
    requireReasonForReturn: z.boolean().default(true),
    requireReasonForVoid: z.boolean().default(true),
    requireReasonForCashDifference: z.boolean().default(true),

    // Keyboard Shortcuts
    shortcuts: z.object({
        saveOrder: z.string().default('F12'),
        printReceipt: z.string().default('F10'),
        printKOT: z.string().default('F9'),
        clearCart: z.string().default('F5'),
    }).default({
        saveOrder: 'F12',
        printReceipt: 'F10',
        printKOT: 'F9',
        clearCart: 'F5',
    }),
});

// --- Printing Settings ---
export const PrintingSettingsSchema = z.object({
    defaultReceiptTemplate: z.string().default('standard'),
    defaultKOTTemplate: z.string().default('kitchen-basic'),
    defaultZReportTemplate: z.string().default('z-report'),
    autoPrintReceipt: z.boolean().default(true),
    autoPrintKOT: z.boolean().default(true),
});

// --- Theme Settings ---
export const ThemeSettingsSchema = z.object({
    mode: z.enum(['light', 'dark', 'system']).default('light'),
    accentColor: z.string().default('#3b82f6'),
    primaryColor: z.string().optional(),
    borderRadius: z.number().default(8),
});

// --- Aggregated System Settings ---
export const SystemSettingsSchema = z.object({
    accounting: AccountingSettingsSchema,
    costing: CostingSettingsSchema,
    inventory: InventorySettingsSchema,
    pos: POSSettingsSchema,
    printing: PrintingSettingsSchema,
    theme: ThemeSettingsSchema,
});

export type SystemSettings = z.infer<typeof SystemSettingsSchema>;

// --- Settings History & API ---
export const SettingsUpdateSchema = z.object({
    category: z.enum(['accounting', 'costing', 'inventory', 'pos', 'printing', 'theme', 'all']),
    data: z.any(),
});

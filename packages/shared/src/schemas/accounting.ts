import { z } from 'zod';

export const AccountTypeEnum = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
export type AccountType = z.infer<typeof AccountTypeEnum>;

export const AccountSchema = z.object({
    id: z.number().optional(),
    code: z.string(),
    name: z.string(),
    type: AccountTypeEnum,
    parent_id: z.number().nullable().optional(),
    is_system: z.boolean().default(false),
});

export type Account = z.infer<typeof AccountSchema>;

export const JournalLineSchema = z.object({
    id: z.number().optional(),
    entry_id: z.string().optional(),
    account_id: z.number(),
    debit: z.number().min(0),
    credit: z.number().min(0),
    description: z.string().optional(),
});

export type JournalLine = z.infer<typeof JournalLineSchema>;

export const JournalEntrySchema = z.object({
    id: z.string().optional(),
    date: z.string(),
    description: z.string(),
    posted: z.boolean().default(false),
    source_type: z.enum([
        'POS_SALES',
        'POS_RETURNS',
        'POS_DELIVERY_COLLECTION',
        'INVENTORY',
        'PURCHASE_INVOICE',
        'PURCHASE_RETURN',
        'SALES_INVOICE',
        'SALES_RETURN',
        'MANUAL',
        'SYSTEM',
        'REVERSAL',
        'SUPPLIER_PAYMENT',
        'CUSTOMER_RECEIPT'
    ]),
    source_id: z.string().optional(),
    lines: z.array(JournalLineSchema),
});

export type JournalEntry = z.infer<typeof JournalEntrySchema>;

export const FinancialStatementItemSchema = z.object({
    account_code: z.string(),
    account_name: z.string(),
    balance: z.number(),
    depth: z.number(),
});

export type FinancialStatementItem = z.infer<typeof FinancialStatementItemSchema>;

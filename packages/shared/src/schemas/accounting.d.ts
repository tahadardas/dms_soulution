import { z } from 'zod';
export declare const AccountTypeEnum: z.ZodEnum<["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]>;
export type AccountType = z.infer<typeof AccountTypeEnum>;
export declare const AccountSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    code: z.ZodString;
    name: z.ZodString;
    type: z.ZodEnum<["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]>;
    parent_id: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    is_system: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
    code: string;
    name: string;
    is_system: boolean;
    id?: number | undefined;
    parent_id?: number | null | undefined;
}, {
    type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
    code: string;
    name: string;
    id?: number | undefined;
    parent_id?: number | null | undefined;
    is_system?: boolean | undefined;
}>;
export type Account = z.infer<typeof AccountSchema>;
export declare const JournalLineSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    entry_id: z.ZodOptional<z.ZodString>;
    account_id: z.ZodNumber;
    debit: z.ZodNumber;
    credit: z.ZodNumber;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    account_id: number;
    debit: number;
    credit: number;
    id?: number | undefined;
    entry_id?: string | undefined;
    description?: string | undefined;
}, {
    account_id: number;
    debit: number;
    credit: number;
    id?: number | undefined;
    entry_id?: string | undefined;
    description?: string | undefined;
}>;
export type JournalLine = z.infer<typeof JournalLineSchema>;
export declare const JournalEntrySchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    date: z.ZodString;
    description: z.ZodString;
    posted: z.ZodDefault<z.ZodBoolean>;
    source_type: z.ZodEnum<["POS_SALES", "INVENTORY", "MANUAL", "SYSTEM"]>;
    source_id: z.ZodOptional<z.ZodString>;
    lines: z.ZodArray<z.ZodObject<{
        id: z.ZodOptional<z.ZodNumber>;
        entry_id: z.ZodOptional<z.ZodString>;
        account_id: z.ZodNumber;
        debit: z.ZodNumber;
        credit: z.ZodNumber;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        account_id: number;
        debit: number;
        credit: number;
        id?: number | undefined;
        entry_id?: string | undefined;
        description?: string | undefined;
    }, {
        account_id: number;
        debit: number;
        credit: number;
        id?: number | undefined;
        entry_id?: string | undefined;
        description?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    date: string;
    description: string;
    posted: boolean;
    source_type: "POS_SALES" | "INVENTORY" | "MANUAL" | "SYSTEM";
    lines: {
        account_id: number;
        debit: number;
        credit: number;
        id?: number | undefined;
        entry_id?: string | undefined;
        description?: string | undefined;
    }[];
    id?: string | undefined;
    source_id?: string | undefined;
}, {
    date: string;
    description: string;
    source_type: "POS_SALES" | "INVENTORY" | "MANUAL" | "SYSTEM";
    lines: {
        account_id: number;
        debit: number;
        credit: number;
        id?: number | undefined;
        entry_id?: string | undefined;
        description?: string | undefined;
    }[];
    id?: string | undefined;
    posted?: boolean | undefined;
    source_id?: string | undefined;
}>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
export declare const FinancialStatementItemSchema: z.ZodObject<{
    account_code: z.ZodString;
    account_name: z.ZodString;
    balance: z.ZodNumber;
    depth: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    account_code: string;
    account_name: string;
    balance: number;
    depth: number;
}, {
    account_code: string;
    account_name: string;
    balance: number;
    depth: number;
}>;
export type FinancialStatementItem = z.infer<typeof FinancialStatementItemSchema>;
//# sourceMappingURL=accounting.d.ts.map
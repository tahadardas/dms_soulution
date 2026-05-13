"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinancialStatementItemSchema = exports.JournalEntrySchema = exports.JournalLineSchema = exports.AccountSchema = exports.AccountTypeEnum = void 0;
const zod_1 = require("zod");
exports.AccountTypeEnum = zod_1.z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
exports.AccountSchema = zod_1.z.object({
    id: zod_1.z.number().optional(),
    code: zod_1.z.string(),
    name: zod_1.z.string(),
    type: exports.AccountTypeEnum,
    parent_id: zod_1.z.number().nullable().optional(),
    is_system: zod_1.z.boolean().default(false),
});
exports.JournalLineSchema = zod_1.z.object({
    id: zod_1.z.number().optional(),
    entry_id: zod_1.z.string().optional(),
    account_id: zod_1.z.number(),
    debit: zod_1.z.number().min(0),
    credit: zod_1.z.number().min(0),
    description: zod_1.z.string().optional(),
});
exports.JournalEntrySchema = zod_1.z.object({
    id: zod_1.z.string().optional(),
    date: zod_1.z.string(),
    description: zod_1.z.string(),
    posted: zod_1.z.boolean().default(false),
    source_type: zod_1.z.enum(['POS_SALES', 'INVENTORY', 'MANUAL', 'SYSTEM']),
    source_id: zod_1.z.string().optional(),
    lines: zod_1.z.array(exports.JournalLineSchema),
});
exports.FinancialStatementItemSchema = zod_1.z.object({
    account_code: zod_1.z.string(),
    account_name: zod_1.z.string(),
    balance: zod_1.z.number(),
    depth: zod_1.z.number(),
});
//# sourceMappingURL=accounting.js.map
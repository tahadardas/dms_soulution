import { z } from 'zod';

export const DocumentStatusEnum = z.enum(['DRAFT', 'POSTED', 'CANCELLED', 'REVERSED']);
export type DocumentStatus = z.infer<typeof DocumentStatusEnum>;

export const DocumentTypeCodeEnum = z.enum([
    'POS_ORDER',
    'SALES_INVOICE',
    'PURCHASE_INVOICE',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'CREDIT_NOTE',
    'DEBIT_NOTE',
    'CUSTOMER_RECEIPT',
    'SUPPLIER_PAYMENT',
    'CASH_IN',
    'CASH_OUT',
    'INVENTORY_ADJUSTMENT',
    'INVENTORY_TRANSFER'
]);
export type DocumentTypeCode = z.infer<typeof DocumentTypeCodeEnum>;

export const CurrencyCodeSchema = z.string().min(3).max(3).transform((value) => value.toUpperCase());

export const DocumentSchema = z.object({
    id: z.string(),
    document_type_code: DocumentTypeCodeEnum,
    source_table: z.string().nullable().optional(),
    source_id: z.string(),
    document_number: z.string().nullable().optional(),
    status: DocumentStatusEnum,
    branch_id: z.number().nullable().optional(),
    currency_code: CurrencyCodeSchema.default('SYP'),
    base_currency_code: CurrencyCodeSchema.default('SYP'),
    exchange_rate: z.number().positive().default(1),
    total_before_discount: z.number().default(0),
    discount_amount: z.number().default(0),
    tax_amount: z.number().default(0),
    total_amount: z.number().default(0),
    base_total_amount: z.number().default(0),
    journal_entry_id: z.string().nullable().optional(),
    posted_at: z.string().nullable().optional(),
    posted_by: z.number().nullable().optional(),
    reversed_by: z.number().nullable().optional(),
    reversed_at: z.string().nullable().optional(),
    reversal_reason: z.string().nullable().optional(),
    created_by: z.number().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().nullable().optional(),
});

export type Document = z.infer<typeof DocumentSchema>;

export const SourceDocumentLinkSchema = z.object({
    id: z.string().optional(),
    source_document_type: DocumentTypeCodeEnum,
    source_document_id: z.string(),
    linked_document_type: DocumentTypeCodeEnum,
    linked_document_id: z.string(),
    link_type: z.enum(['CREATED_FROM', 'REVERSAL_OF', 'PAYMENT_FOR', 'TRANSFER_PAIR', 'REFERENCE']),
    created_by: z.number().nullable().optional(),
    metadata: z.record(z.unknown()).nullable().optional(),
});

export type SourceDocumentLink = z.infer<typeof SourceDocumentLinkSchema>;

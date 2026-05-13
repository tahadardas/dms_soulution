import { Database as DatabaseType } from 'better-sqlite3';
import crypto from 'crypto';

export type DocumentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED' | 'REVERSED';

export type DocumentTypeCode =
    | 'POS_ORDER'
    | 'SALES_INVOICE'
    | 'PURCHASE_INVOICE'
    | 'SALES_RETURN'
    | 'PURCHASE_RETURN'
    | 'CREDIT_NOTE'
    | 'DEBIT_NOTE'
    | 'CUSTOMER_RECEIPT'
    | 'SUPPLIER_PAYMENT'
    | 'CASH_IN'
    | 'CASH_OUT'
    | 'INVENTORY_ADJUSTMENT'
    | 'INVENTORY_TRANSFER';

export interface UpsertDocumentInput {
    documentTypeCode: DocumentTypeCode;
    sourceTable?: string | null;
    sourceId: string;
    documentNumber?: string | null;
    status: DocumentStatus;
    branchId?: number | null;
    currencyCode?: string | null;
    baseCurrencyCode?: string | null;
    exchangeRate?: number | null;
    totalBeforeDiscount?: number | null;
    discountAmount?: number | null;
    taxAmount?: number | null;
    totalAmount?: number | null;
    journalEntryId?: string | null;
    postedAt?: string | null;
    postedBy?: number | null;
    reversedBy?: number | null;
    reversedAt?: string | null;
    reversalReason?: string | null;
    createdBy?: number | null;
}

export interface SourceDocumentLinkInput {
    sourceDocumentType: DocumentTypeCode;
    sourceDocumentId: string;
    linkedDocumentType: DocumentTypeCode;
    linkedDocumentId: string;
    linkType: 'CREATED_FROM' | 'REVERSAL_OF' | 'PAYMENT_FOR' | 'TRANSFER_PAIR' | 'REFERENCE';
    createdBy?: number | null;
    metadata?: Record<string, unknown> | null;
}

const DEFAULT_BASE_CURRENCY = 'SYP';

function normalizeCurrency(value?: string | null): string {
    return String(value || DEFAULT_BASE_CURRENCY).trim().toUpperCase();
}

function normalizeExchangeRate(value?: number | null): number {
    const rate = Number(value ?? 1);
    if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error('Document exchange rate must be greater than zero.');
    }
    return rate;
}

function money(value?: number | null): number {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) {
        throw new Error('Document amount must be a finite number.');
    }
    return amount;
}

export class DocumentService {
    constructor(private db: DatabaseType) {}

    listDocumentTypes() {
        return this.db.prepare(`
            SELECT dt.*, df.name as family_name
            FROM document_types dt
            JOIN document_families df ON df.code = dt.family_code
            WHERE dt.is_active = 1
            ORDER BY df.code, dt.code
        `).all();
    }

    getDocument(documentTypeCode: DocumentTypeCode, sourceId: string) {
        return this.db.prepare(`
            SELECT *
            FROM documents
            WHERE document_type_code = ? AND source_id = ?
        `).get(documentTypeCode, sourceId);
    }

    upsertDocument(input: UpsertDocumentInput) {
        const currencyCode = normalizeCurrency(input.currencyCode);
        const baseCurrencyCode = normalizeCurrency(input.baseCurrencyCode);
        const exchangeRate = normalizeExchangeRate(input.exchangeRate);
        const totalBeforeDiscount = money(input.totalBeforeDiscount);
        const discountAmount = money(input.discountAmount);
        const taxAmount = money(input.taxAmount);
        const totalAmount = money(input.totalAmount);
        const baseTotalAmount = totalAmount * exchangeRate;
        const id = `${input.documentTypeCode}:${input.sourceId}`;

        this.db.prepare(`
            INSERT INTO documents (
                id, document_type_code, source_table, source_id, document_number, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, reversed_by, reversed_at, reversal_reason, created_by
            )
            VALUES (
                @id, @document_type_code, @source_table, @source_id, @document_number, @status,
                @branch_id, @currency_code, @base_currency_code, @exchange_rate,
                @total_before_discount, @discount_amount, @tax_amount, @total_amount, @base_total_amount,
                @journal_entry_id, @posted_at, @posted_by, @reversed_by, @reversed_at, @reversal_reason, @created_by
            )
            ON CONFLICT(document_type_code, source_id) DO UPDATE SET
                source_table = excluded.source_table,
                document_number = excluded.document_number,
                status = excluded.status,
                branch_id = excluded.branch_id,
                currency_code = excluded.currency_code,
                base_currency_code = excluded.base_currency_code,
                exchange_rate = excluded.exchange_rate,
                total_before_discount = excluded.total_before_discount,
                discount_amount = excluded.discount_amount,
                tax_amount = excluded.tax_amount,
                total_amount = excluded.total_amount,
                base_total_amount = excluded.base_total_amount,
                journal_entry_id = excluded.journal_entry_id,
                posted_at = COALESCE(excluded.posted_at, documents.posted_at),
                posted_by = COALESCE(excluded.posted_by, documents.posted_by),
                reversed_by = COALESCE(excluded.reversed_by, documents.reversed_by),
                reversed_at = COALESCE(excluded.reversed_at, documents.reversed_at),
                reversal_reason = COALESCE(excluded.reversal_reason, documents.reversal_reason),
                updated_at = datetime('now')
        `).run({
            id,
            document_type_code: input.documentTypeCode,
            source_table: input.sourceTable ?? null,
            source_id: input.sourceId,
            document_number: input.documentNumber ?? null,
            status: input.status,
            branch_id: input.branchId ?? null,
            currency_code: currencyCode,
            base_currency_code: baseCurrencyCode,
            exchange_rate: exchangeRate,
            total_before_discount: totalBeforeDiscount,
            discount_amount: discountAmount,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            base_total_amount: baseTotalAmount,
            journal_entry_id: input.journalEntryId ?? null,
            posted_at: input.postedAt ?? null,
            posted_by: input.postedBy ?? null,
            reversed_by: input.reversedBy ?? null,
            reversed_at: input.reversedAt ?? null,
            reversal_reason: input.reversalReason ?? null,
            created_by: input.createdBy ?? null
        });

        return this.getDocument(input.documentTypeCode, input.sourceId);
    }

    markPosted(input: {
        documentTypeCode: DocumentTypeCode;
        sourceId: string;
        journalEntryId: string;
        postedBy?: number | null;
        postedAt?: string | null;
    }): void {
        const info = this.db.prepare(`
            UPDATE documents
            SET status = 'POSTED',
                journal_entry_id = ?,
                posted_by = ?,
                posted_at = COALESCE(?, datetime('now')),
                updated_at = datetime('now')
            WHERE document_type_code = ? AND source_id = ? AND status = 'DRAFT'
        `).run(
            input.journalEntryId,
            input.postedBy ?? null,
            input.postedAt ?? null,
            input.documentTypeCode,
            input.sourceId
        );
        if (info.changes === 0) {
            const existing = this.getDocument(input.documentTypeCode, input.sourceId) as { status?: string } | undefined;
            if (existing?.status === 'POSTED') {
                throw new Error('Document has already been posted.');
            }
            if (existing) {
                throw new Error(`Only draft documents can be posted. Current status: ${existing.status}`);
            }
        }
    }

    markReversed(input: {
        documentTypeCode: DocumentTypeCode;
        sourceId: string;
        reversedBy?: number | null;
        reversalReason?: string | null;
    }): void {
        const reason = String(input.reversalReason || '').trim();
        if (!reason) {
            throw new Error('Reversal reason is required.');
        }
        const info = this.db.prepare(`
            UPDATE documents
            SET status = 'REVERSED',
                reversed_by = ?,
                reversed_at = datetime('now'),
                reversal_reason = ?,
                updated_at = datetime('now')
            WHERE document_type_code = ? AND source_id = ? AND status = 'POSTED'
        `).run(input.reversedBy ?? null, reason, input.documentTypeCode, input.sourceId);
        if (info.changes === 0) {
            throw new Error('Only posted documents can be reversed.');
        }
    }

    linkDocuments(input: SourceDocumentLinkInput) {
        const id = crypto.randomUUID();
        this.db.prepare(`
            INSERT OR IGNORE INTO source_document_links (
                id, source_document_type, source_document_id, linked_document_type, linked_document_id,
                link_type, created_by, metadata
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id,
            input.sourceDocumentType,
            input.sourceDocumentId,
            input.linkedDocumentType,
            input.linkedDocumentId,
            input.linkType,
            input.createdBy ?? null,
            input.metadata ? JSON.stringify(input.metadata) : null
        );
        return this.db.prepare('SELECT * FROM source_document_links WHERE id = ?').get(id);
    }

    nextDocumentNumber(documentTypeCode: DocumentTypeCode, branchId: number | null, date = new Date()): string {
        const year = date.getFullYear();
        const documentType = this.db.prepare('SELECT number_prefix FROM document_types WHERE code = ?').get(documentTypeCode) as { number_prefix: string } | undefined;
        if (!documentType) {
            throw new Error(`Document type ${documentTypeCode} is not configured.`);
        }

        this.db.prepare(`
            INSERT OR IGNORE INTO document_sequences (document_type_code, branch_id, fiscal_year, prefix, next_number)
            VALUES (?, ?, ?, ?, 1)
        `).run(documentTypeCode, branchId ?? null, year, documentType.number_prefix);

        const row = this.db.prepare(`
            SELECT id, prefix, next_number, padding
            FROM document_sequences
            WHERE document_type_code = ?
              AND COALESCE(branch_id, -1) = COALESCE(?, -1)
              AND fiscal_year = ?
        `).get(documentTypeCode, branchId ?? null, year) as { id: number; prefix: string; next_number: number; padding: number } | undefined;
        if (!row) {
            throw new Error('Document sequence is not available.');
        }

        this.db.prepare(`
            UPDATE document_sequences
            SET next_number = next_number + 1,
                updated_at = datetime('now')
            WHERE id = ?
        `).run(row.id);

        const branchPart = branchId ? `-B${branchId}` : '';
        return `${row.prefix}${branchPart}-${year}-${String(row.next_number).padStart(row.padding, '0')}`;
    }
}

import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

const documentStatusConstraint = "TEXT NOT NULL DEFAULT 'DRAFT' CHECK (document_status IN ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED'))";

function ensureDocumentColumns(db: Database, tableName: string, options: { status?: boolean; amountSource?: 'amount' | 'total_amount' | 'total_refund' | 'inventory' } = {}): void {
    if (options.status) {
        ensureColumn(db, tableName, 'document_status', documentStatusConstraint);
    }
    ensureColumn(db, tableName, 'document_type_code', 'TEXT');
    ensureColumn(db, tableName, 'currency_code', "TEXT NOT NULL DEFAULT 'SYP'");
    ensureColumn(db, tableName, 'base_currency_code', "TEXT NOT NULL DEFAULT 'SYP'");
    ensureColumn(db, tableName, 'exchange_rate', 'REAL NOT NULL DEFAULT 1');
    ensureColumn(db, tableName, 'total_before_discount', 'REAL NOT NULL DEFAULT 0');
    ensureColumn(db, tableName, 'base_total_amount', 'REAL NOT NULL DEFAULT 0');
    ensureColumn(db, tableName, 'reversed_by', 'INTEGER');
    ensureColumn(db, tableName, 'reversed_at', 'TEXT');
    ensureColumn(db, tableName, 'reversal_reason', 'TEXT');

    if (options.amountSource === 'amount') {
        db.exec(`
            UPDATE ${tableName}
            SET total_before_discount = COALESCE(NULLIF(total_before_discount, 0), amount, 0),
                base_total_amount = COALESCE(NULLIF(base_total_amount, 0), amount * exchange_rate, 0)
            WHERE amount IS NOT NULL;
        `);
    } else if (options.amountSource === 'total_amount') {
        db.exec(`
            UPDATE ${tableName}
            SET total_before_discount = COALESCE(NULLIF(total_before_discount, 0), total_amount + COALESCE(discount_amount, 0), total_amount, 0),
                base_total_amount = COALESCE(NULLIF(base_total_amount, 0), total_amount * exchange_rate, 0)
            WHERE total_amount IS NOT NULL;
        `);
    } else if (options.amountSource === 'inventory') {
        db.exec(`
            UPDATE ${tableName}
            SET total_before_discount = COALESCE(NULLIF(total_before_discount, 0), ABS(quantity) * COALESCE(unit_cost, 0), 0),
                base_total_amount = COALESCE(NULLIF(base_total_amount, 0), ABS(quantity) * COALESCE(unit_cost, 0) * exchange_rate, 0)
            WHERE quantity IS NOT NULL;
        `);
    } else if (options.amountSource === 'total_refund') {
        db.exec(`
            UPDATE ${tableName}
            SET total_before_discount = COALESCE(NULLIF(total_before_discount, 0), total_refund, 0),
                base_total_amount = COALESCE(NULLIF(base_total_amount, 0), total_refund * exchange_rate, 0)
            WHERE total_refund IS NOT NULL;
        `);
    }
}

export const migration: Migration = {
    version: '0028',
    name: 'document_model_and_currency_foundation',
    up(db: Database): void {
        db.exec(`
            DROP TRIGGER IF EXISTS prevent_inventory_update;
            DROP TRIGGER IF EXISTS prevent_inventory_delete;

            CREATE TABLE IF NOT EXISTS currencies (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                symbol TEXT,
                decimal_places INTEGER NOT NULL DEFAULT 2,
                is_base INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS exchange_rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                currency_code TEXT NOT NULL,
                base_currency_code TEXT NOT NULL DEFAULT 'SYP',
                rate_date TEXT NOT NULL,
                rate REAL NOT NULL CHECK (rate > 0),
                source TEXT,
                created_by INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(currency_code, base_currency_code, rate_date),
                FOREIGN KEY(currency_code) REFERENCES currencies(code),
                FOREIGN KEY(base_currency_code) REFERENCES currencies(code),
                FOREIGN KEY(created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS document_families (
                code TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                is_financial INTEGER NOT NULL DEFAULT 0,
                is_inventory INTEGER NOT NULL DEFAULT 0,
                is_cash INTEGER NOT NULL DEFAULT 0,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS document_types (
                code TEXT PRIMARY KEY,
                family_code TEXT NOT NULL,
                name TEXT NOT NULL,
                source_table TEXT,
                source_id_column TEXT NOT NULL DEFAULT 'id',
                number_prefix TEXT NOT NULL,
                status_model TEXT NOT NULL DEFAULT 'DOCUMENT',
                affects_accounting INTEGER NOT NULL DEFAULT 0,
                affects_inventory INTEGER NOT NULL DEFAULT 0,
                is_return INTEGER NOT NULL DEFAULT 0,
                is_cash_document INTEGER NOT NULL DEFAULT 0,
                allow_manual_number INTEGER NOT NULL DEFAULT 0,
                default_currency_code TEXT NOT NULL DEFAULT 'SYP',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                FOREIGN KEY(family_code) REFERENCES document_families(code),
                FOREIGN KEY(default_currency_code) REFERENCES currencies(code)
            );

            CREATE TABLE IF NOT EXISTS document_sequences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_type_code TEXT NOT NULL,
                branch_id INTEGER,
                fiscal_year INTEGER NOT NULL,
                prefix TEXT NOT NULL,
                next_number INTEGER NOT NULL DEFAULT 1 CHECK (next_number > 0),
                padding INTEGER NOT NULL DEFAULT 6 CHECK (padding BETWEEN 1 AND 12),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                UNIQUE(document_type_code, branch_id, fiscal_year),
                FOREIGN KEY(document_type_code) REFERENCES document_types(code),
                FOREIGN KEY(branch_id) REFERENCES branches(id)
            );

            CREATE TABLE IF NOT EXISTS document_posting_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_type_code TEXT NOT NULL,
                event TEXT NOT NULL DEFAULT 'POST',
                sequence INTEGER NOT NULL DEFAULT 1,
                rule_name TEXT NOT NULL,
                debit_account_role TEXT,
                credit_account_role TEXT,
                amount_basis TEXT NOT NULL,
                inventory_effect TEXT,
                is_required INTEGER NOT NULL DEFAULT 1,
                is_active INTEGER NOT NULL DEFAULT 1,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                UNIQUE(document_type_code, event, sequence, rule_name),
                FOREIGN KEY(document_type_code) REFERENCES document_types(code)
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                document_type_code TEXT NOT NULL,
                source_table TEXT,
                source_id TEXT NOT NULL,
                document_number TEXT,
                status TEXT NOT NULL CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED', 'REVERSED')),
                branch_id INTEGER,
                currency_code TEXT NOT NULL DEFAULT 'SYP',
                base_currency_code TEXT NOT NULL DEFAULT 'SYP',
                exchange_rate REAL NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
                total_before_discount REAL NOT NULL DEFAULT 0,
                discount_amount REAL NOT NULL DEFAULT 0,
                tax_amount REAL NOT NULL DEFAULT 0,
                total_amount REAL NOT NULL DEFAULT 0,
                base_total_amount REAL NOT NULL DEFAULT 0,
                journal_entry_id TEXT,
                posted_at TEXT,
                posted_by INTEGER,
                reversed_by INTEGER,
                reversed_at TEXT,
                reversal_reason TEXT,
                created_by INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT,
                UNIQUE(document_type_code, source_id),
                UNIQUE(document_type_code, branch_id, document_number),
                FOREIGN KEY(document_type_code) REFERENCES document_types(code),
                FOREIGN KEY(branch_id) REFERENCES branches(id),
                FOREIGN KEY(currency_code) REFERENCES currencies(code),
                FOREIGN KEY(base_currency_code) REFERENCES currencies(code),
                FOREIGN KEY(journal_entry_id) REFERENCES journal_entries(id),
                FOREIGN KEY(posted_by) REFERENCES users(id),
                FOREIGN KEY(reversed_by) REFERENCES users(id),
                FOREIGN KEY(created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS source_document_links (
                id TEXT PRIMARY KEY,
                source_document_type TEXT NOT NULL,
                source_document_id TEXT NOT NULL,
                linked_document_type TEXT NOT NULL,
                linked_document_id TEXT NOT NULL,
                link_type TEXT NOT NULL,
                created_by INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                UNIQUE(source_document_type, source_document_id, linked_document_type, linked_document_id, link_type),
                FOREIGN KEY(source_document_type) REFERENCES document_types(code),
                FOREIGN KEY(linked_document_type) REFERENCES document_types(code),
                FOREIGN KEY(created_by) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS payment_allocations (
                id TEXT PRIMARY KEY,
                payment_document_type TEXT NOT NULL,
                payment_document_id TEXT NOT NULL,
                invoice_document_type TEXT NOT NULL,
                invoice_document_id TEXT NOT NULL,
                allocation_date TEXT NOT NULL,
                currency_code TEXT NOT NULL DEFAULT 'SYP',
                foreign_amount REAL NOT NULL CHECK (foreign_amount >= 0),
                base_amount REAL NOT NULL CHECK (base_amount >= 0),
                exchange_rate REAL NOT NULL DEFAULT 1 CHECK (exchange_rate > 0),
                realized_fx_gain_loss REAL NOT NULL DEFAULT 0,
                created_by INTEGER,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(payment_document_type, payment_document_id, invoice_document_type, invoice_document_id),
                FOREIGN KEY(currency_code) REFERENCES currencies(code),
                FOREIGN KEY(created_by) REFERENCES users(id)
            );

            INSERT OR IGNORE INTO currencies (code, name, symbol, decimal_places, is_base, is_active)
            VALUES
                ('SYP', 'Syrian Pound', 'SYP', 2, 1, 1),
                ('USD', 'US Dollar', 'USD', 2, 0, 1);

            INSERT OR IGNORE INTO exchange_rates (currency_code, base_currency_code, rate_date, rate, source)
            VALUES
                ('SYP', 'SYP', '2026-01-01', 1, 'system'),
                ('USD', 'SYP', '2026-01-01', 1, 'bootstrap-placeholder');

            INSERT OR IGNORE INTO document_families (code, name, description, is_financial, is_inventory, is_cash)
            VALUES
                ('POS', 'Point of Sale', 'POS orders and POS returns', 1, 1, 1),
                ('SALES', 'Sales', 'Sales invoices, returns, and credit notes', 1, 1, 0),
                ('PURCHASE', 'Purchase', 'Purchase invoices, returns, and debit notes', 1, 1, 0),
                ('PAYMENT', 'Payments', 'Customer receipts and supplier payments', 1, 0, 1),
                ('CASH', 'Cash Movements', 'Cash in and cash out documents', 1, 0, 1),
                ('INVENTORY', 'Inventory', 'Inventory adjustments and transfers', 0, 1, 0);

            INSERT OR IGNORE INTO document_types (
                code, family_code, name, source_table, number_prefix, affects_accounting,
                affects_inventory, is_return, is_cash_document, allow_manual_number
            )
            VALUES
                ('POS_ORDER', 'POS', 'POS Order', 'orders', 'POS', 1, 1, 0, 1, 0),
                ('SALES_INVOICE', 'SALES', 'Sales Invoice', 'sales_invoices', 'SI', 1, 1, 0, 0, 1),
                ('PURCHASE_INVOICE', 'PURCHASE', 'Purchase Invoice', 'purchase_invoices', 'PI', 1, 1, 0, 0, 1),
                ('SALES_RETURN', 'SALES', 'Sales Return', 'returns', 'SR', 1, 1, 1, 0, 0),
                ('PURCHASE_RETURN', 'PURCHASE', 'Purchase Return', NULL, 'PR', 1, 1, 1, 0, 0),
                ('CREDIT_NOTE', 'SALES', 'Credit Note', NULL, 'CN', 1, 1, 1, 0, 0),
                ('DEBIT_NOTE', 'PURCHASE', 'Debit Note', NULL, 'DN', 1, 1, 1, 0, 0),
                ('CUSTOMER_RECEIPT', 'PAYMENT', 'Customer Receipt', 'customer_receipts', 'CR', 1, 0, 0, 1, 0),
                ('SUPPLIER_PAYMENT', 'PAYMENT', 'Supplier Payment', 'supplier_payments', 'SP', 1, 0, 0, 1, 0),
                ('CASH_IN', 'CASH', 'Cash In', 'cash_movements', 'CIN', 1, 0, 0, 1, 0),
                ('CASH_OUT', 'CASH', 'Cash Out', 'cash_movements', 'COUT', 1, 0, 0, 1, 0),
                ('INVENTORY_ADJUSTMENT', 'INVENTORY', 'Inventory Adjustment', 'inventory_movements', 'IA', 0, 1, 0, 0, 0),
                ('INVENTORY_TRANSFER', 'INVENTORY', 'Inventory Transfer', 'inventory_movements', 'IT', 0, 1, 0, 0, 0);
        `);

        ensureDocumentColumns(db, 'purchase_invoices', { amountSource: 'total_amount' });
        ensureDocumentColumns(db, 'sales_invoices', { amountSource: 'total_amount' });
        ensureDocumentColumns(db, 'orders', { amountSource: 'total_amount' });
        ensureDocumentColumns(db, 'customer_receipts', { status: true, amountSource: 'amount' });
        ensureDocumentColumns(db, 'supplier_payments', { status: true, amountSource: 'amount' });
        ensureDocumentColumns(db, 'cash_movements', { status: true, amountSource: 'amount' });
        ensureDocumentColumns(db, 'inventory_movements', { status: true, amountSource: 'inventory' });
        ensureDocumentColumns(db, 'returns', { status: true, amountSource: 'total_refund' });

        ensureColumn(db, 'purchase_invoices', 'base_tax_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'sales_invoices', 'base_tax_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'customer_receipts', 'unapplied_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'supplier_payments', 'unapplied_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'journal_entries', 'currency_code', "TEXT NOT NULL DEFAULT 'SYP'");
        ensureColumn(db, 'journal_entries', 'base_currency_code', "TEXT NOT NULL DEFAULT 'SYP'");
        ensureColumn(db, 'journal_entries', 'exchange_rate', 'REAL NOT NULL DEFAULT 1');
        ensureColumn(db, 'journal_lines', 'currency_code', "TEXT NOT NULL DEFAULT 'SYP'");
        ensureColumn(db, 'journal_lines', 'exchange_rate', 'REAL NOT NULL DEFAULT 1');
        ensureColumn(db, 'journal_lines', 'foreign_debit', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'journal_lines', 'foreign_credit', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'journal_lines', 'base_debit', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'journal_lines', 'base_credit', 'REAL NOT NULL DEFAULT 0');

        db.exec(`
            UPDATE purchase_invoices
            SET document_type_code = COALESCE(document_type_code, 'PURCHASE_INVOICE'),
                base_tax_amount = COALESCE(NULLIF(base_tax_amount, 0), tax_amount * exchange_rate, 0);
            UPDATE sales_invoices
            SET document_type_code = COALESCE(document_type_code, 'SALES_INVOICE'),
                base_tax_amount = COALESCE(NULLIF(base_tax_amount, 0), tax_amount * exchange_rate, 0);
            UPDATE orders SET document_type_code = COALESCE(document_type_code, 'POS_ORDER');
            UPDATE customer_receipts
            SET document_type_code = COALESCE(document_type_code, 'CUSTOMER_RECEIPT'),
                document_status = CASE WHEN journal_entry_id IS NOT NULL THEN 'POSTED' ELSE document_status END,
                unapplied_amount = COALESCE(NULLIF(unapplied_amount, 0), amount, 0);
            UPDATE supplier_payments
            SET document_type_code = COALESCE(document_type_code, 'SUPPLIER_PAYMENT'),
                document_status = CASE WHEN journal_entry_id IS NOT NULL THEN 'POSTED' ELSE document_status END,
                unapplied_amount = COALESCE(NULLIF(unapplied_amount, 0), amount, 0);
            UPDATE cash_movements
            SET document_type_code = COALESCE(document_type_code, CASE WHEN type = 'CASH_OUT' THEN 'CASH_OUT' ELSE 'CASH_IN' END),
                document_status = CASE WHEN status = 'COMPLETED' THEN 'POSTED' ELSE document_status END;
            UPDATE inventory_movements
            SET document_type_code = COALESCE(
                    document_type_code,
                    CASE WHEN source_type = 'TRANSFER' OR type IN ('TRANSFER_IN', 'TRANSFER_OUT') THEN 'INVENTORY_TRANSFER' ELSE 'INVENTORY_ADJUSTMENT' END
                ),
                document_status = 'POSTED';
            UPDATE returns
            SET document_type_code = COALESCE(document_type_code, 'SALES_RETURN'),
                document_status = 'POSTED';
            UPDATE journal_lines
            SET foreign_debit = COALESCE(NULLIF(foreign_debit, 0), debit, 0),
                foreign_credit = COALESCE(NULLIF(foreign_credit, 0), credit, 0),
                base_debit = COALESCE(NULLIF(base_debit, 0), debit * exchange_rate, debit, 0),
                base_credit = COALESCE(NULLIF(base_credit, 0), credit * exchange_rate, credit, 0);
        `);

        db.exec(`
            INSERT OR IGNORE INTO document_posting_rules
                (document_type_code, event, sequence, rule_name, debit_account_role, credit_account_role, amount_basis, inventory_effect, metadata)
            VALUES
                ('PURCHASE_INVOICE', 'POST', 1, 'Inventory receipt', 'INVENTORY', NULL, 'inventory_total', 'INCREASE', '{}'),
                ('PURCHASE_INVOICE', 'POST', 2, 'Input VAT', 'VAT_INPUT', NULL, 'tax_amount', NULL, '{}'),
                ('PURCHASE_INVOICE', 'POST', 3, 'Supplier payable', NULL, 'AP_CONTROL', 'gross_total', NULL, '{}'),
                ('SALES_INVOICE', 'POST', 1, 'Customer receivable', 'AR_CONTROL', NULL, 'gross_total', NULL, '{}'),
                ('SALES_INVOICE', 'POST', 2, 'Sales revenue', NULL, 'SALES_REVENUE', 'net_total', NULL, '{}'),
                ('SALES_INVOICE', 'POST', 3, 'Output VAT', NULL, 'VAT_OUTPUT', 'tax_amount', NULL, '{}'),
                ('SALES_INVOICE', 'POST', 4, 'COGS', 'COGS', 'INVENTORY', 'cogs_total', 'DECREASE', '{}'),
                ('CUSTOMER_RECEIPT', 'POST', 1, 'Customer collection', 'CASH_OR_BANK', 'AR_CONTROL', 'amount', NULL, '{}'),
                ('SUPPLIER_PAYMENT', 'POST', 1, 'Supplier settlement', 'AP_CONTROL', 'CASH_OR_BANK', 'amount', NULL, '{}'),
                ('CASH_IN', 'POST', 1, 'Cash in', 'CASH', 'CASH_IN_OFFSET', 'amount', NULL, '{}'),
                ('CASH_OUT', 'POST', 1, 'Cash out', 'CASH_OUT_OFFSET', 'CASH', 'amount', NULL, '{}'),
                ('INVENTORY_ADJUSTMENT', 'POST', 1, 'Inventory adjustment', 'INVENTORY_GAIN_LOSS', 'INVENTORY_GAIN_LOSS', 'movement_value', 'ADJUST', '{}'),
                ('INVENTORY_TRANSFER', 'POST', 1, 'Inventory transfer', 'INVENTORY', 'INVENTORY', 'movement_value', 'TRANSFER', '{}');

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, document_number, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, reversed_by, reversed_at, reversal_reason, created_by, created_at
            )
            SELECT
                'PURCHASE_INVOICE:' || id, 'PURCHASE_INVOICE', 'purchase_invoices', id, invoice_number,
                CASE status WHEN 'POSTED' THEN 'POSTED' WHEN 'CANCELLED' THEN 'CANCELLED' ELSE 'DRAFT' END,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, reversed_by, reversed_at, reversal_reason, created_by, created_at
            FROM purchase_invoices;

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, document_number, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, reversed_by, reversed_at, reversal_reason, created_by, created_at
            )
            SELECT
                'SALES_INVOICE:' || id, 'SALES_INVOICE', 'sales_invoices', id, invoice_number,
                CASE status WHEN 'POSTED' THEN 'POSTED' WHEN 'CANCELLED' THEN 'CANCELLED' ELSE 'DRAFT' END,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, reversed_by, reversed_at, reversal_reason, created_by, created_at
            FROM sales_invoices;

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, document_number, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, created_at
            )
            SELECT
                'POS_ORDER:' || id, 'POS_ORDER', 'orders', id, order_number,
                CASE
                    WHEN status = 'VOID' THEN 'CANCELLED'
                    WHEN status = 'RETURNED' THEN 'REVERSED'
                    WHEN journal_entry_id IS NOT NULL THEN 'POSTED'
                    ELSE 'DRAFT'
                END,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, COALESCE(discount_amount, 0), tax_amount, total_amount, base_total_amount,
                journal_entry_id, created_at, NULL, created_at
            FROM orders;

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, created_by, created_at
            )
            SELECT
                'CUSTOMER_RECEIPT:' || id, 'CUSTOMER_RECEIPT', 'customer_receipts', id, document_status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, 0, 0, amount, base_total_amount,
                journal_entry_id, created_at, created_by, created_by, created_at
            FROM customer_receipts;

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                journal_entry_id, posted_at, posted_by, created_by, created_at
            )
            SELECT
                'SUPPLIER_PAYMENT:' || id, 'SUPPLIER_PAYMENT', 'supplier_payments', id, document_status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, 0, 0, amount, base_total_amount,
                journal_entry_id, created_at, created_by, created_by, created_at
            FROM supplier_payments;

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                posted_at, posted_by, created_by, created_at
            )
            SELECT
                document_type_code || ':' || id, document_type_code, 'cash_movements', id, document_status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, 0, 0, amount, base_total_amount,
                created_at, created_by, created_by, created_at
            FROM cash_movements;

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                posted_at, created_by, created_at
            )
            SELECT
                document_type_code || ':' || id, document_type_code, 'inventory_movements', id, document_status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, 0, 0, total_before_discount, base_total_amount,
                created_at, created_by, created_at
            FROM inventory_movements
            WHERE document_type_code IN ('INVENTORY_ADJUSTMENT', 'INVENTORY_TRANSFER');

            INSERT OR IGNORE INTO documents (
                id, document_type_code, source_table, source_id, status,
                branch_id, currency_code, base_currency_code, exchange_rate,
                total_before_discount, discount_amount, tax_amount, total_amount, base_total_amount,
                posted_at, created_by, created_at
            )
            SELECT
                'SALES_RETURN:' || id, 'SALES_RETURN', 'returns', id, document_status,
                NULL, currency_code, base_currency_code, exchange_rate,
                total_before_discount, 0, 0, total_refund, base_total_amount,
                created_at, created_by, created_at
            FROM returns;

            CREATE INDEX IF NOT EXISTS idx_documents_type_status ON documents(document_type_code, status);
            CREATE INDEX IF NOT EXISTS idx_documents_branch_date ON documents(branch_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_documents_journal ON documents(journal_entry_id);
            CREATE INDEX IF NOT EXISTS idx_document_sequences_lookup ON document_sequences(document_type_code, branch_id, fiscal_year);
            CREATE INDEX IF NOT EXISTS idx_source_document_links_source ON source_document_links(source_document_type, source_document_id);
            CREATE INDEX IF NOT EXISTS idx_source_document_links_linked ON source_document_links(linked_document_type, linked_document_id);
            CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_document_type, payment_document_id);
            CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice ON payment_allocations(invoice_document_type, invoice_document_id);

            CREATE TRIGGER IF NOT EXISTS prevent_inventory_update
            BEFORE UPDATE ON inventory_movements
            BEGIN
                SELECT RAISE(ABORT, 'Inventory movements are immutable');
            END;

            CREATE TRIGGER IF NOT EXISTS prevent_inventory_delete
            BEFORE DELETE ON inventory_movements
            BEGIN
                SELECT RAISE(ABORT, 'Inventory movements are immutable');
            END;
        `);
    }
};

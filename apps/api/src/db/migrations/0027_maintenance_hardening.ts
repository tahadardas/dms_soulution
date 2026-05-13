import type { Database } from 'better-sqlite3';
import { ensureColumn } from '../introspect';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0027',
    name: 'maintenance_hardening',
    up(db: Database): void {
        ensureColumn(db, 'users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
        ensureColumn(db, 'users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0');
        ensureColumn(db, 'users', 'failed_login_count', 'INTEGER NOT NULL DEFAULT 0');
        ensureColumn(db, 'users', 'locked_until', 'TEXT');
        ensureColumn(db, 'users', 'last_failed_login_at', 'TEXT');
        ensureColumn(db, 'users', 'password_changed_at', 'TEXT');

        ensureColumn(db, 'journal_entries', 'unbalanced_reason', 'TEXT');
        ensureColumn(db, 'journal_entries', 'created_by', 'INTEGER');
        ensureColumn(db, 'journal_entries', 'updated_at', 'TEXT');

        ensureColumn(db, 'purchase_invoices', 'discount_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'purchase_invoices', 'landed_cost_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'purchase_invoices', 'journal_entry_id', 'TEXT');
        ensureColumn(db, 'purchase_invoices', 'posted_by', 'INTEGER');
        ensureColumn(db, 'purchase_invoices', 'posted_at', 'TEXT');
        ensureColumn(db, 'purchase_invoices', 'source_document_type', 'TEXT');
        ensureColumn(db, 'purchase_invoices', 'source_document_id', 'TEXT');

        ensureColumn(db, 'purchase_invoice_lines', 'discount_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'purchase_invoice_lines', 'discount_rate', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'purchase_invoice_lines', 'landed_cost_amount', 'REAL NOT NULL DEFAULT 0');

        ensureColumn(db, 'sales_invoices', 'discount_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'sales_invoices', 'paid_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'sales_invoices', 'journal_entry_id', 'TEXT');
        ensureColumn(db, 'sales_invoices', 'posted_by', 'INTEGER');
        ensureColumn(db, 'sales_invoices', 'posted_at', 'TEXT');
        ensureColumn(db, 'sales_invoices', 'source_document_type', 'TEXT');
        ensureColumn(db, 'sales_invoices', 'source_document_id', 'TEXT');

        ensureColumn(db, 'sales_invoice_lines', 'discount_amount', 'REAL NOT NULL DEFAULT 0');
        ensureColumn(db, 'sales_invoice_lines', 'discount_rate', 'REAL NOT NULL DEFAULT 0');

        ensureColumn(db, 'orders', 'source_document_type', 'TEXT');
        ensureColumn(db, 'orders', 'source_document_id', 'TEXT');
        ensureColumn(db, 'orders', 'journal_entry_id', 'TEXT');

        ensureColumn(db, 'inventory_movements', 'source_type', 'TEXT');
        ensureColumn(db, 'inventory_movements', 'entered_unit_id', 'INTEGER');
        ensureColumn(db, 'inventory_movements', 'entered_quantity', 'REAL');
        ensureColumn(db, 'inventory_movements', 'base_quantity', 'REAL');

        ensureColumn(db, 'products', 'base_unit_id', 'INTEGER');

        ensureColumn(db, 'customers', 'tax_number', 'TEXT');
        ensureColumn(db, 'customers', 'is_active', 'INTEGER NOT NULL DEFAULT 1');

        db.exec(`
            UPDATE products SET base_unit_id = unit_id WHERE base_unit_id IS NULL;
            UPDATE inventory_movements
            SET source_type = COALESCE(source_type, type),
                entered_quantity = COALESCE(entered_quantity, ABS(quantity)),
                base_quantity = COALESCE(base_quantity, quantity)
            WHERE source_type IS NULL OR entered_quantity IS NULL OR base_quantity IS NULL;

            CREATE INDEX IF NOT EXISTS idx_journal_entries_source_pair
                ON journal_entries(source_type, source_id);
            CREATE INDEX IF NOT EXISTS idx_accounts_party
                ON accounts(party_type, party_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_source
                ON inventory_movements(source_type, reference_id);
            CREATE INDEX IF NOT EXISTS idx_purchase_invoices_journal
                ON purchase_invoices(journal_entry_id);
            CREATE INDEX IF NOT EXISTS idx_sales_invoices_journal
                ON sales_invoices(journal_entry_id);
            CREATE INDEX IF NOT EXISTS idx_orders_source_document
                ON orders(source_document_type, source_document_id);
        `);
    }
};

import type { Database } from 'better-sqlite3';
import type { Migration } from '../migrate';

export const migration: Migration = {
    version: '0002',
    name: 'core_indexes',
    up(db: Database): void {
        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
            CREATE INDEX IF NOT EXISTS idx_journal_entries_posted ON journal_entries(posted);
            CREATE INDEX IF NOT EXISTS idx_journal_entries_branch ON journal_entries(branch_id);
            CREATE INDEX IF NOT EXISTS idx_journal_entries_source ON journal_entries(source_type);
            CREATE INDEX IF NOT EXISTS idx_journal_entries_source_id ON journal_entries(source_id);
            CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(entry_id);
            CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

            CREATE INDEX IF NOT EXISTS idx_accounts_parent ON accounts(parent_id);
            CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
            CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
            CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
            CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);
            CREATE INDEX IF NOT EXISTS idx_units_name ON units(name);
            CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);
            CREATE INDEX IF NOT EXISTS idx_recipes_ingredient ON recipes(ingredient_id);
            CREATE INDEX IF NOT EXISTS idx_unit_conversions_from ON unit_conversions(from_unit_id);
            CREATE INDEX IF NOT EXISTS idx_unit_conversions_to ON unit_conversions(to_unit_id);

            CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_branch ON inventory_movements(branch_id);
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(type);
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_date ON inventory_movements(date);
            CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);

            CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(session_id);
            CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);
            CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
            CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
            CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
            CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
            CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);
            CREATE INDEX IF NOT EXISTS idx_order_lines_order_id ON order_lines(order_id);
            CREATE INDEX IF NOT EXISTS idx_order_lines_product_id ON order_lines(product_id);
            CREATE INDEX IF NOT EXISTS idx_order_notes_order_id ON order_notes(order_id);
            CREATE INDEX IF NOT EXISTS idx_returns_original_order_id ON returns(original_order_id);
            CREATE INDEX IF NOT EXISTS idx_return_lines_return_id ON return_lines(return_id);
            CREATE INDEX IF NOT EXISTS idx_return_lines_order_line_id ON return_lines(order_line_id);

            CREATE INDEX IF NOT EXISTS idx_printers_branch ON printers(branch_id);
            CREATE INDEX IF NOT EXISTS idx_printer_routes_scope ON printer_routes(scope_type, scope_value);
            CREATE INDEX IF NOT EXISTS idx_printer_routes_job ON printer_routes(job_type);
            CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status);
            CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at);
            CREATE INDEX IF NOT EXISTS idx_print_jobs_created ON print_jobs(created_at);

            CREATE INDEX IF NOT EXISTS idx_pos_sessions_start_time ON pos_sessions(start_time);
            CREATE INDEX IF NOT EXISTS idx_pos_sessions_status ON pos_sessions(status);
        `);
    }
};

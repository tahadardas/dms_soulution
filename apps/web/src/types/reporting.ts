export interface SalesReportItem {
    key: string | number;
    label: string;
    quantity?: number;
    revenue?: number;
    cost?: number;
    orders?: number;
    category_name?: string | null;
}

export interface SalesReportResponse {
    items: SalesReportItem[];
    groupBy: string;
}

export interface SalesTransactionItem {
    order_id: string;
    order_number?: string | null;
    created_at: string;
    total_amount?: number;
    payment_method?: string | null;
    product_name?: string | null;
    category_name?: string | null;
    quantity?: number;
    unit_price?: number;
    total_price?: number;
    cost_at_time?: number;
    journal_entry_id?: string | null;
}

export interface SessionsReportItem {
    session_id: string;
    start_time: string;
    end_time?: string | null;
    opening_cash?: number | null;
    closing_cash?: number | null;
    status: string;
    branch_name?: string | null;
    user_name?: string | null;
    orders_count?: number;
    total_sales?: number;
    cash_sales?: number;
    card_sales?: number;
    transfer_sales?: number;
    delivery_pending?: number;
    delivery_collected?: number;
    delivery_cash_collected?: number;
    cash_refunds?: number;
    voids?: number;
    discounts?: number;
    cash_in?: number;
    cash_out?: number;
    expected_cash?: number | null;
    actual_cash?: number | null;
    cash_difference?: number | null;
    cash_difference_reason?: string | null;
    approved_by_name?: string | null;
}

export interface SessionOrderItem {
    order_id: string;
    order_number?: string | null;
    created_at: string;
    total_amount: number;
    payment_method?: string | null;
    journal_entry_id?: string | null;
}

export interface InventoryReportItem {
    key: string | number;
    label: string;
    qty_in?: number;
    qty_out?: number;
    net?: number;
}

export interface InventoryMovementDetail {
    id: string;
    date: string;
    type: string;
    product_id: number;
    product_name?: string | null;
    quantity: number;
    unit_cost?: number | null;
    reference_id?: string | null;
    description?: string | null;
    reason?: string | null;
    branch_id?: number | null;
    branch_name?: string | null;
    journal_entry_id?: string | null;
}

export interface InventoryReportResponse {
    items: Array<InventoryReportItem | InventoryMovementDetail | { key: string; label: string; net: number }>;
    groupBy: string;
}

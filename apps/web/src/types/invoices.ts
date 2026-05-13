export interface Supplier {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_number?: string;
    is_active: number;
    payable_account_id?: number;
    advance_account_id?: number;
    payable_account_code?: string;
    payable_account_name?: string;
    currency_code?: string;
    opening_balance?: number;
}

export interface PurchaseInvoiceLine {
    id: number;
    invoice_id: string;
    product_id: number;
    product_name?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    tax_amount: number;
}

export interface PurchaseInvoice {
    id: string;
    supplier_id: number;
    supplier_name?: string;
    branch_id: number;
    invoice_number: string;
    date: string;
    status: 'DRAFT' | 'POSTED' | 'CANCELLED';
    total_amount: number;
    tax_amount: number;
    notes?: string;
    created_by: number;
    created_at: string;
    lines?: PurchaseInvoiceLine[];
}

export interface SalesInvoiceLine {
    id: number;
    invoice_id: string;
    product_id: number;
    product_name?: string;
    quantity: number;
    unit_price: number;
    cost_at_time: number;
    total_price: number;
    tax_amount: number;
}

export interface SalesInvoice {
    id: string;
    customer_id: number;
    customer_name?: string;
    branch_id: number;
    invoice_number: string;
    date: string;
    status: 'DRAFT' | 'POSTED' | 'CANCELLED';
    total_amount: number;
    tax_amount: number;
    payment_status: 'UNPAID' | 'PARTIAL' | 'PAID';
    notes?: string;
    created_by: number;
    created_at: string;
    lines?: SalesInvoiceLine[];
}

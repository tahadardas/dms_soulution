export interface Branch {
    id: number;
    name: string;
}

export interface InventoryItem {
    id: number;
    name: string;
    sku: string;
    type: string;
    price: number;
    cost?: number;
    min_stock_level?: number | null;
    category_id?: number | null;
    category_name?: string | null;
    unit_id?: number | null;
    unit_name?: string | null;
    unit_abbr?: string | null;
    is_active?: number;
    on_hand: number;
}

export interface InventoryMovement {
    id: string;
    date: string;
    type: string;
    product_id: number;
    product_name?: string;
    quantity: number;
    unit_cost?: number | null;
    reference_id?: string | null;
    description?: string | null;
    reason?: string | null;
    branch_id?: number | null;
    branch_name?: string | null;
    created_by?: number | null;
    created_by_name?: string | null;
}

export interface InventoryAlert extends InventoryItem {
    threshold: number;
}

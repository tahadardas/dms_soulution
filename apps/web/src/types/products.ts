export interface Category {
    id: number;
    name: string;
    description?: string | null;
    color?: string | null;
    is_active?: number;
}

export interface Unit {
    id: number;
    name: string;
    abbreviation: string;
    is_active?: number;
}

export interface UnitConversion {
    id: number;
    from_unit_id: number;
    to_unit_id: number;
    multiplier: number;
    from_name?: string;
    from_abbr?: string;
    to_name?: string;
    to_abbr?: string;
}

export interface Product {
    id: number;
    name: string;
    sku: string;
    type: string;
    description?: string | null;
    price: number;
    cost?: number;
    stock_quantity?: number;
    min_stock_level?: number | null;
    category_id?: number | null;
    category_name?: string | null;
    unit_id?: number | null;
    unit_name?: string | null;
    unit_abbr?: string | null;
    is_active?: number;
    created_at?: string | null;
    updated_at?: string | null;
}

export interface RecipeLine {
    id?: number | string;
    ingredient_id: number;
    ingredient_name?: string;
    quantity: number;
    unit_id?: number | null;
    unit_name?: string | null;
    unit_abbr?: string | null;
    waste_percent?: number | null;
    notes?: string | null;
}

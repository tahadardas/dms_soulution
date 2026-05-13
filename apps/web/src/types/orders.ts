export interface OrderLine {
    id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    notes?: string;
    returned_quantity?: number;
}

export type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
export type PaymentStatus = 'PAID' | 'UNPAID' | 'REFUNDED';
export type DeliveryStatus = 'OUT_FOR_DELIVERY' | 'DELIVERED' | null;
export type OrderStatus = 'COMPLETED' | 'VOID' | 'RETURNED' | 'PENDING_DELIVERY';

export interface Order {
    id: string;
    order_number: string;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
    lines: OrderLine[];
    notes?: string;
    table_number?: string;
    discount_amount?: number;
    discount_type?: 'PERCENTAGE' | 'FIXED';
    order_type?: OrderType;
    payment_status?: PaymentStatus;
    delivery_status?: DeliveryStatus;
    delivery_person_name?: string;
    delivery_phone?: string;
    delivery_address?: string;
    delivery_notes?: string;
    collected_at?: string;
    collected_by?: number;
    items_count?: number;
}

export interface PendingDeliveryOrder {
    id: string;
    order_number: string;
    created_at: string;
    total: number;
    payment_status: PaymentStatus;
    delivery_status: DeliveryStatus;
    delivery_person_name?: string;
    delivery_phone?: string;
    delivery_address?: string;
    items_count: number;
}

export interface ReturnRecord {
    id: string;
    original_order_id: string;
    reason: string;
    total_refund: number;
    created_at: string;
    order_number?: string;
    cashier_name?: string;
}

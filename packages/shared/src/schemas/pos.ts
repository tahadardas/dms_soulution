import { z } from 'zod';

export const POSSessionStatusSchema = z.enum(['OPEN', 'CLOSED']);

export const OrderStatusSchema = z.enum([
    'DRAFT',
    'COMPLETED',
    'VOID',
    'RETURNED'
]);

export const PaymentMethodSchema = z.enum([
    'CASH',
    'CARD',
    'TRANSFER'
]);

export const POSProductSchema = z.object({
    id: z.number().int(),
    name: z.string(),
    sku: z.string().optional(),
    price: z.number().nonnegative()
});

export const OpenPOSSessionSchema = z.object({
    userId: z.number().int().positive().optional(),
    branchId: z.number().int().positive().nullable().optional(),
    openingCash: z.number().nonnegative().default(0)
});

export const ClosePOSSessionSchema = z.object({
    sessionId: z.string().uuid(),
    closingCash: z.number().nonnegative(),
    notes: z.string().optional()
});

export const POSSessionSchema = z.object({
    id: z.string().uuid(),
    user_id: z.number().int().positive().optional(),
    branch_id: z.number().int().positive().nullable().optional(),
    status: POSSessionStatusSchema,
    opening_cash: z.number().optional(),
    closing_cash: z.number().nullable().optional(),
    start_time: z.string().optional(),
    end_time: z.string().nullable().optional(),
    notes: z.string().nullable().optional()
});

export const OrderLineSchema = z.object({
    id: z.number().int().positive().optional(),
    product_id: z.number().int().positive(),
    product_name: z.string().optional(),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative().optional(),
    total_price: z.number().nonnegative().optional(),
    returned_quantity: z.number().nonnegative().optional(),
    notes: z.string().nullable().optional()
});

export const CreateOrderItemSchema = z.object({
    productId: z.number().int().positive(),
    quantity: z.number().positive(),
    note: z.string().optional()
});

export const CreateOrderSchema = z.object({
    sessionId: z.string().uuid(),
    customerId: z.number().int().positive().optional(),
    items: z.array(CreateOrderItemSchema).min(1),
    notes: z.array(z.string()).optional(),
    tableNumber: z.string().nullable().optional(),
    orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']).optional(),
    paymentMode: z.enum(['PAY_NOW', 'PAY_LATER']).optional(),
    paymentMethod: PaymentMethodSchema.optional()
});

export const OrderSchema = z.object({
    id: z.string().uuid(),
    session_id: z.string().uuid().optional(),
    customer_id: z.number().int().positive().nullable().optional(),
    order_number: z.string(),
    status: OrderStatusSchema,
    total_amount: z.number().nonnegative(),
    table_number: z.string().nullable().optional(),
    payment_method: PaymentMethodSchema.optional(),
    created_at: z.string().optional(),
    lines: z.array(OrderLineSchema).optional()
});

export const ReturnLineSchema = z.object({
    orderLineId: z.number().int().positive(),
    quantity: z.number().positive()
});

export const CreateReturnSchema = z.object({
    orderId: z.string().uuid(),
    reason: z.string().min(1),
    items: z.array(ReturnLineSchema).min(1)
});

export const POSReturnSchema = z.object({
    id: z.string().uuid(),
    original_order_id: z.string().uuid(),
    reason: z.string(),
    total_refund: z.number().nonnegative(),
    created_by: z.number().int().positive().optional(),
    created_at: z.string().optional()
});

export type POSSessionStatus = z.infer<typeof POSSessionStatusSchema>;
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type POSProduct = z.infer<typeof POSProductSchema>;
export type OpenPOSSession = z.infer<typeof OpenPOSSessionSchema>;
export type ClosePOSSession = z.infer<typeof ClosePOSSessionSchema>;
export type POSSession = z.infer<typeof POSSessionSchema>;
export type OrderLine = z.infer<typeof OrderLineSchema>;
export type CreateOrderItem = z.infer<typeof CreateOrderItemSchema>;
export type CreateOrder = z.infer<typeof CreateOrderSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type ReturnLine = z.infer<typeof ReturnLineSchema>;
export type CreateReturn = z.infer<typeof CreateReturnSchema>;
export type POSReturn = z.infer<typeof POSReturnSchema>;

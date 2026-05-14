import { z } from 'zod';

export const POSSessionStatusEnum = z.enum(['OPEN', 'CLOSED']);
export type POSSessionStatus = z.infer<typeof POSSessionStatusEnum>;

export const POSSessionSchema = z.object({
    id: z.union([z.string(), z.number()]),
    userId: z.number(),
    branchId: z.number().nullable().optional(),
    status: POSSessionStatusEnum,
    openingCash: z.number(),
    closingCash: z.number().optional().nullable(),
    openedAt: z.string().optional(),
    closedAt: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
});
export type POSSession = z.infer<typeof POSSessionSchema>;

export const OpenPOSSessionSchema = z.object({
    userId: z.number(),
    branchId: z.number().nullable().optional(),
    openingCash: z.number(),
    stationId: z.string().optional().nullable()
});
export type OpenPOSSession = z.infer<typeof OpenPOSSessionSchema>;

export const ClosePOSSessionSchema = z.object({
    sessionId: z.union([z.string(), z.number()]),
    closingCash: z.number(),
    notes: z.string().optional().nullable(),
    managerUsername: z.string().optional().nullable(),
    managerPassword: z.string().optional().nullable(),
    reason: z.string().optional().nullable(),
    userId: z.number().optional()
});
export type ClosePOSSession = z.infer<typeof ClosePOSSessionSchema>;

export const OrderStatusEnum = z.enum(['PENDING', 'PAID', 'VOID', 'COMPLETED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusEnum>;

export const PaymentMethodEnum = z.enum(['CASH', 'CARD', 'TRANSFER', 'CREDIT']);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const POSCartItemSchema = z.object({
    productId: z.number(),
    quantity: z.number().min(0.001),
    note: z.string().optional().nullable(),
    unitPrice: z.number().optional()
});
export type CreateOrderItem = z.infer<typeof POSCartItemSchema>;

export const POSOrderSchema = z.object({
    sessionId: z.union([z.string(), z.number()]),
    items: z.array(POSCartItemSchema).min(1, 'Cart cannot be empty'),
    tableNumber: z.string().optional().nullable(),
    orderType: z.enum(['DINE_IN', 'TAKEAWAY', 'DELIVERY']),
    paymentMode: z.enum(['PAY_NOW', 'PAY_LATER']),
    paymentMethod: PaymentMethodEnum,
    customerId: z.number().optional().nullable(),
    discountAmount: z.number().default(0),
    discountType: z.enum(['PERCENTAGE', 'FIXED']).default('PERCENTAGE'),
    serviceCharge: z.number().default(0),
    tipsAmount: z.number().default(0),
    deliveryPersonName: z.string().optional().nullable(),
    deliveryPhone: z.string().optional().nullable(),
    deliveryAddress: z.string().optional().nullable(),
    deliveryNotes: z.string().optional().nullable(),
    deliveryCourierId: z.number().optional().nullable(),
    deliveryCommissionAmount: z.number().optional().nullable(),
    deliveryCommissionType: z.enum(['NONE', 'FIXED_PER_ORDER', 'PERCENT_OF_ORDER', 'MANUAL']).optional().nullable()
});
export type CreateOrder = z.infer<typeof POSOrderSchema>;
export type POSOrder = CreateOrder; // For backward compatibility

export const OrderLineSchema = z.object({
    id: z.number(),
    orderId: z.union([z.string(), z.number()]),
    productId: z.number(),
    quantity: z.number(),
    unitPrice: z.number(),
    total: z.number(),
    note: z.string().optional().nullable()
});
export type OrderLine = z.infer<typeof OrderLineSchema>;

export const OrderSchema = z.object({
    id: z.union([z.string(), z.number()]),
    orderNumber: z.string(),
    totalAmount: z.number(),
    status: OrderStatusEnum,
    createdAt: z.string().optional()
});
export type Order = z.infer<typeof OrderSchema>;

export const POSProductSchema = z.object({
    id: z.number(),
    name: z.string(),
    price: z.number(),
    sku: z.string(),
    type: z.string().optional().nullable()
});
export type POSProduct = z.infer<typeof POSProductSchema>;

export const ReturnLineSchema = z.object({
    id: z.number(),
    returnId: z.number(),
    orderLineId: z.number(),
    quantity: z.number(),
    unitPrice: z.number().optional(),
    total: z.number().optional()
});
export type ReturnLine = z.infer<typeof ReturnLineSchema>;

export const POSReturnSchema = z.object({
    id: z.number(),
    orderId: z.union([z.string(), z.number()]),
    totalRefund: z.number(),
    reason: z.string().optional().nullable(),
    createdAt: z.string().optional()
});
export type POSReturn = z.infer<typeof POSReturnSchema>;

export const CreateReturnSchema = z.object({
    orderId: z.union([z.string(), z.number()]),
    items: z.array(z.object({
        orderLineId: z.number(),
        quantity: z.number()
    })),
    reason: z.string().optional().nullable()
});
export type CreateReturn = z.infer<typeof CreateReturnSchema>;

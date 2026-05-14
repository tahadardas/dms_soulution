import { z } from 'zod';

export const InvoiceLineSchema = z.object({
    productId: z.number({ required_error: 'Product is required' }),
    name: z.string(),
    quantity: z.number().min(0.001, 'Quantity must be greater than 0'),
    unitPrice: z.number().min(0, 'Price cannot be negative'),
    taxRate: z.number().optional().default(0),
    discount: z.number().optional().default(0),
    total: z.number()
});

export const InvoiceSchema = z.object({
    type: z.enum(['purchase', 'sales']),
    partnerId: z.number({ required_error: 'Please select a partner' }),
    date: z.string().or(z.date()),
    reference: z.string().optional(),
    items: z.array(InvoiceLineSchema).min(1, 'At least one item is required'),
    notes: z.string().optional(),
    subtotal: z.number(),
    taxTotal: z.number().default(0),
    discountTotal: z.number().default(0),
    total: z.number()
});

export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;

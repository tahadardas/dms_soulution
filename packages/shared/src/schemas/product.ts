import { z } from 'zod';

export const ProductFormSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().min(1, 'SKU is required'),
    type: z.enum(['FINISHED_GOOD', 'RAW_MATERIAL', 'SERVICE']),
    price: z.number().min(0, 'Price cannot be negative'),
    description: z.string().optional().nullable(),
    min_stock_level: z.number().optional().nullable(),
    category_id: z.number().optional().nullable(),
    unit_id: z.number().optional().nullable(),
    is_active: z.boolean().default(true)
});

export type ProductFormValues = z.infer<typeof ProductFormSchema>;

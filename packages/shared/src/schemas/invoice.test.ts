import { describe, it, expect } from 'vitest';
import { InvoiceSchema } from './invoice';

describe('InvoiceSchema', () => {
    it('should validate a correct invoice', () => {
        const validInvoice = {
            type: 'purchase',
            partnerId: 1,
            date: '2023-01-01',
            items: [
                {
                    productId: 101,
                    name: 'Test Product',
                    quantity: 5,
                    unitPrice: 10,
                    total: 50
                }
            ],
            subtotal: 50,
            total: 50
        };

        const result = InvoiceSchema.safeParse(validInvoice);
        expect(result.success).toBe(true);
    });

    it('should fail if items are empty', () => {
        const invalidInvoice = {
            type: 'sales',
            partnerId: 1,
            date: '2023-01-01',
            items: [],
            subtotal: 0,
            total: 0
        };

        const result = InvoiceSchema.safeParse(invalidInvoice);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0].message).toBe('At least one item is required');
        }
    });

    it('should fail if partnerId is missing', () => {
        const invalidInvoice = {
            type: 'purchase',
            date: '2023-01-01',
            items: [{ productId: 1, name: 'P', quantity: 1, unitPrice: 1, total: 1 }],
            subtotal: 1,
            total: 1
        };

        const result = InvoiceSchema.safeParse(invalidInvoice);
        expect(result.success).toBe(false);
    });
});

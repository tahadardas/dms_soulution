import { useState } from 'react';
import { useApi } from './useApi';

export const usePOSOrders = (sessionId: number) => {
    const api = useApi();
    const [submitting, setSubmitting] = useState(false);

    const submitOrder = async (orderData: {
        items: any[];
        payment_method: string;
        amount_paid: number;
        discount?: number;
        customer_id?: number;
        notes?: string;
    }) => {
        if (!sessionId) throw new Error('No active session');
        setSubmitting(true);
        try {
            const res = await api<any>(`/pos/sessions/${sessionId}/orders`, {
                method: 'POST',
                body: JSON.stringify({
                    ...orderData,
                    idempotencyKey: Math.random().toString(36).substring(7) // Basic idempotency
                })
            });
            return res;
        } finally {
            setSubmitting(false);
        }
    };

    return {
        submitOrder,
        submitting
    };
};

import { useState, useCallback } from 'react';

export interface CartItem {
    product_id: number;
    name: string;
    quantity: number;
    price: number;
    total: number;
    tax_rate?: number;
}

export const usePOSCart = () => {
    const [items, setItems] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState(0);

    const addItem = useCallback((product: any) => {
        setItems(prev => {
            const existing = prev.find(item => item.product_id === product.id);
            if (existing) {
                return prev.map(item => 
                    item.product_id === product.id 
                        ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
                        : item
                );
            }
            return [...prev, {
                product_id: product.id,
                name: product.name,
                quantity: 1,
                price: product.sale_price,
                total: product.sale_price
            }];
        });
    }, []);

    const updateQuantity = useCallback((productId: number, quantity: number) => {
        if (quantity <= 0) {
            setItems(prev => prev.filter(item => item.product_id !== productId));
            return;
        }
        setItems(prev => prev.map(item => 
            item.product_id === productId 
                ? { ...item, quantity, total: quantity * item.price }
                : item
        ));
    }, []);

    const clearCart = useCallback(() => {
        setItems([]);
        setDiscount(0);
    }, []);

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const total = subtotal - discount;

    return {
        items,
        addItem,
        updateQuantity,
        clearCart,
        discount,
        setDiscount,
        subtotal,
        total
    };
};

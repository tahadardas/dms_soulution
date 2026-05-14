import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from './AuthContext';
import { OrderType } from '../types/orders';
import { POSOrderSchema } from '@dms/shared';

export interface Product {
    id: number;
    name: string;
    price: number;
    sku: string;
    stock_quantity?: number | null;
    type?: string;
    min_stock_level?: number | null;
}

export interface CartItem extends Product {
    quantity: number;
    note?: string;
}

export interface POSSession {
    id: string;
    status: 'OPEN' | 'CLOSED';
}

interface POSContextType {
    session: POSSession | null;
    cart: CartItem[];
    activeTable: string | null;
    notes: string[];
    orderType: OrderType;
    paymentMode: 'PAY_NOW' | 'PAY_LATER';
    paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT';
    customerId: number | null;
    setCustomerId: (id: number | null) => void;
    deliveryInfo: { 
        personName?: string; 
        phone?: string; 
        address?: string; 
        notes?: string;
        courierId?: number;
        courierOneTime?: boolean;
        commissionAmount?: number;
        commissionType?: 'NONE' | 'FIXED_PER_ORDER' | 'PERCENT_OF_ORDER' | 'MANUAL';
    };
    addToCart: (product: Product) => void;
    removeFromCart: (productId: number) => void;
    updateQuantity: (productId: number, delta: number) => void;
    updateItemNote: (productId: number, note: string) => void;
    clearCart: () => void;
    addNote: (note: string) => void;
    removeNote: (index: number) => void;
    clearNotes: () => void;
    setTable: (table: string | null) => void;
    setOrderType: (type: OrderType) => void;
    setPaymentMode: (mode: 'PAY_NOW' | 'PAY_LATER') => void;
    setPaymentMethod: (method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT') => void;
    setDeliveryInfo: (info: Partial<POSContextType['deliveryInfo']>) => void;
    setDiscount: (amount: number, type?: 'PERCENTAGE' | 'FIXED') => void;
    discount: { amount: number; type: 'PERCENTAGE' | 'FIXED' };
    serviceCharge: number;
    setServiceCharge: (amount: number) => void;
    tipsAmount: number;
    setTipsAmount: (amount: number) => void;
    openSession: (openingCash: number) => Promise<void>;
    closeSession: (closingCash: number, options?: {
        notes?: string;
        reason?: string;
        managerUsername?: string;
        managerPassword?: string;
    }) => Promise<void>;
    submitOrder: () => Promise<any>;
    lastOrder: { orderId: string; orderNumber: string; totalAmount: number } | null;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider = ({ children }: { children: ReactNode }) => {
    const [session, setSession] = useState<POSSession | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeTable, setActiveTable] = useState<string | null>(null);
    const [notes, setNotes] = useState<string[]>([]);
    const [orderType, setOrderType] = useState<OrderType>('DINE_IN');
    const [paymentMode, setPaymentMode] = useState<'PAY_NOW' | 'PAY_LATER'>('PAY_NOW');
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT'>('CASH');
    const [customerId, setCustomerId] = useState<number | null>(null);
    const [deliveryInfo, setDeliveryInfoState] = useState<POSContextType['deliveryInfo']>({});
    const [discount, setDiscountState] = useState<{ amount: number; type: 'PERCENTAGE' | 'FIXED' }>({ amount: 0, type: 'PERCENTAGE' });
    const [serviceCharge, setServiceCharge] = useState<number>(0);
    const [tipsAmount, setTipsAmount] = useState<number>(0);
    const [lastOrder, setLastOrder] = useState<POSContextType['lastOrder']>(null);
    const [stationId] = useState(() => {
        let sid = localStorage.getItem('pos_station_id');
        if (!sid) {
            sid = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('pos_station_id', sid);
        }
        return sid;
    });
    const api = useApi();
    const { user } = useAuth();

    useEffect(() => {
        let mounted = true;
        if (!user) {
            setSession(null);
            return;
        }
        api<{ id: string; status: POSSession['status'] } | null>(`/pos/sessions/active?stationId=${stationId}`)
            .then((data) => {
                if (mounted && data?.id) {
                    setSession({ id: data.id, status: data.status || 'OPEN' });
                }
            })
            .catch(() => {
                // ignore for now
            });
        return () => {
            mounted = false;
        };
    }, [api, user]);

    const addToCart = (product: Product) => {
        setCart((prev: CartItem[]) => {
            const existing = prev.find((i: CartItem) => i.id === product.id);
            if (existing) {
                return prev.map((i: CartItem) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...product, quantity: 1 }];
        });
    };

    const removeFromCart = (productId: number) => {
        setCart((prev: CartItem[]) => prev.filter((i: CartItem) => i.id !== productId));
    };

    const clearCart = () => setCart([]);

    const updateQuantity = (productId: number, delta: number) => {
        setCart((prev: CartItem[]) => {
            return prev
                .map((i: CartItem) => i.id === productId ? { ...i, quantity: Math.max(0, i.quantity + delta) } : i)
                .filter((i: CartItem) => i.quantity > 0);
        });
    };

    const updateItemNote = (productId: number, note: string) => {
        setCart((prev: CartItem[]) =>
            prev.map((i: CartItem) =>
                i.id === productId ? { ...i, note: note || undefined } : i
            )
        );
    };

    const setTable = (table: string | null) => setActiveTable(table);

    const clearNotes = () => setNotes([]);

    const openSession = async (openingCash: number) => {
        try {
            const data = await api<{ id: string; status: POSSession['status'] }>('/pos/sessions/open', {
                method: 'POST',
                body: JSON.stringify({
                    openingCash,
                    branchId: user?.branch_id || 1,
                    stationId
                })
            });
            if (data?.id) {
                setSession({ id: data.id, status: 'OPEN' });
            }
        } catch (err: any) {
            if (String(err?.message || '').includes('open session')) {
                const active = await api<{ id: string; status: POSSession['status'] } | null>(`/pos/sessions/active?stationId=${stationId}`);
                if (active?.id) {
                    setSession({ id: active.id, status: active.status || 'OPEN' });
                    return;
                }
            }
            throw err;
        }
    };

    const closeSession = async (closingCash: number, options: {
        notes?: string;
        reason?: string;
        managerUsername?: string;
        managerPassword?: string;
    } = {}) => {
        if (!session) return;
        await api('/pos/sessions/close', {
            method: 'POST',
            body: JSON.stringify({
                sessionId: session.id,
                closingCash,
                notes: options.notes,
                reason: options.reason,
                managerUsername: options.managerUsername,
                managerPassword: options.managerPassword
            })
        });
        setSession(null);
        clearCart();
        clearNotes();
    };

    const resetOrderState = () => {
        clearCart();
        setTable(null);
        clearNotes();
        setOrderType('DINE_IN');
        setPaymentMode('PAY_NOW');
        setPaymentMethod('CASH');
        setCustomerId(null);
        setDeliveryInfoState({});
        setDiscountState({ amount: 0, type: 'PERCENTAGE' });
        setServiceCharge(0);
        setTipsAmount(0);
    };

    const setDiscount = (amount: number, type: 'PERCENTAGE' | 'FIXED' = 'PERCENTAGE') => {
        setDiscountState({ amount, type });
    };

    const submitOrder = async () => {
        if (!session || cart.length === 0) return;
        const orderData = {
            sessionId: session.id,
            items: cart.map(i => ({ productId: i.id, quantity: i.quantity, note: i.note })),
            tableNumber: activeTable,
            notes,
            orderType,
            paymentMode,
            paymentMethod,
            deliveryPersonName: deliveryInfo.personName,
            deliveryPhone: deliveryInfo.phone,
            deliveryAddress: deliveryInfo.address,
            deliveryNotes: deliveryInfo.notes,
            deliveryCourierId: deliveryInfo.courierId,
            deliveryCourierOneTime: deliveryInfo.courierOneTime,
            deliveryCommissionAmount: deliveryInfo.commissionAmount,
            deliveryCommissionType: deliveryInfo.commissionType,
            discountAmount: discount.amount,
            discountType: discount.type,
            serviceCharge,
            tipsAmount,
            customerId
        };

        const validation = POSOrderSchema.safeParse(orderData);
        if (!validation.success) {
            console.error('POS Validation failed:', validation.error.format());
            throw new Error(validation.error.issues[0].message);
        }

        try {
            const data = await api<any>('/pos/orders', {
                method: 'POST',
                body: JSON.stringify(validation.data)
            });

            // Handle Printing - Removed from submitOrder to separate saving from printing
            if (data?.orderId) {
                setLastOrder({
                    orderId: data.orderId,
                    orderNumber: data.orderNumber,
                    totalAmount: data.totalAmount
                });

                resetOrderState();
            }
            return data;
        } catch (err) {
            console.error('Order submission failed:', err);
            throw err;
        }
    };

    return (
        <POSContext.Provider value={{
            session,
            cart,
            activeTable,
            notes,
            orderType,
            paymentMode,
            paymentMethod,
            deliveryInfo,
            addToCart,
            removeFromCart,
            updateQuantity,
            updateItemNote,
            clearCart,
            addNote: (note: string) => setNotes(prev => [...prev, note]),
            removeNote: (index: number) => setNotes(prev => prev.filter((_, idx) => idx !== index)),
            clearNotes,
            setTable,
            setOrderType,
            setPaymentMode,
            setPaymentMethod,
            setDeliveryInfo: (info) => setDeliveryInfoState(prev => ({ ...prev, ...info })),
            setDiscount,
            discount,
            serviceCharge,
            setServiceCharge,
            tipsAmount,
            setTipsAmount,
            customerId,
            setCustomerId,
            openSession,
            closeSession,
            submitOrder,
            lastOrder
        }}>
            {children}
        </POSContext.Provider>
    );
};

export const usePOS = () => {
    const context = useContext(POSContext);
    if (!context) throw new Error('usePOS must be used within a POSProvider');
    return context;
};

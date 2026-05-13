import React, { useState, useEffect } from 'react';
import { Button, Modal, useToast } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { usePOS } from '../../context/POSContext';
import { useCurrencyFormatter } from '../../hooks/useCurrencyFormatter';
import { PendingDeliveryOrder } from '../../types/orders';
import { useCan } from '../../hooks/useCan';
import { PERMISSIONS } from '../../lib/permissions';

interface PendingDeliveryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export const PendingDeliveryDrawer: React.FC<PendingDeliveryDrawerProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const api = useApi();
    const { formatCurrency } = useCurrencyFormatter();
    const toast = useToast();
    const { session } = usePOS();
    const canCollectDelivery = useCan(PERMISSIONS.POS_DELIVERY_COLLECT);
    const [orders, setOrders] = useState<PendingDeliveryOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [collectingOrder, setCollectingOrder] = useState<PendingDeliveryOrder | null>(null);
    const [collectionPaymentMethod, setCollectionPaymentMethod] = useState<PaymentMethod>('CASH');
    const [isCollecting, setIsCollecting] = useState(false);
    const paymentMethods: PaymentMethod[] = ['CASH', 'CARD', 'TRANSFER'];

    const fetchOrders = async () => {
        if (!session?.id) return;
        setLoading(true);
        try {
            const data = await api<{ items: PendingDeliveryOrder[] }>(`/pos/orders/pending-delivery?sessionId=${session.id}`);
            setOrders(data.items || []);
        } catch (err) {
            console.error('Failed to fetch pending orders', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchOrders();
        }
    }, [isOpen]);

    const handleCollect = async () => {
        if (!collectingOrder || !session) return;
        setIsCollecting(true);
        try {
            await api(`/pos/orders/${collectingOrder.id}/collect-delivery`, {
                method: 'POST',
                body: JSON.stringify({
                    amount: collectingOrder.total,
                    paymentMethod: collectionPaymentMethod,
                    sessionId: session.id
                })
            });
            toast.success(t('pos.pendingOrders.collectSuccess'));
            setCollectingOrder(null);
            setCollectionPaymentMethod('CASH');
            fetchOrders();
        } catch (err: any) {
            toast.error(err.message || t('pos.pendingOrders.collectFailed'));
        } finally {
            setIsCollecting(false);
        }
    };

    const openCollectDialog = (order: PendingDeliveryOrder) => {
        setCollectingOrder(order);
        setCollectionPaymentMethod('CASH');
    };

    const closeCollectDialog = () => {
        setCollectingOrder(null);
        setCollectionPaymentMethod('CASH');
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={t('pos.pendingOrders.title')}
            >
                <div className="pos-drawer-content">
                    {loading ? (
                        <div className="pos-loading">{t('common.loading')}</div>
                    ) : orders.length === 0 ? (
                        <div className="pos-empty">{t('pos.pendingOrders.empty')}</div>
                    ) : (
                        <div className="pos-order-grid">
                            {orders.map((order) => (
                                <div key={order.id} className="pos-order-card">
                                    <div className="pos-order-card__header">
                                        <span className="pos-order-card__number">{order.order_number}</span>
                                        <span className="pos-order-card__total">{formatCurrency(order.total)}</span>
                                    </div>
                                    <div className="pos-order-card__body">
                                        <div className="pos-order-card__info">
                                            <span>📅 {new Date(order.created_at).toLocaleTimeString()}</span>
                                            <span>📦 {t('pos.pendingOrders.itemsCount', { count: order.items_count })}</span>
                                        </div>
                                        {order.delivery_person_name && (
                                            <div className="pos-order-card__delivery">
                                                👤 {order.delivery_person_name}
                                                {order.delivery_phone && <span className="ml-2 text-xs opacity-70">({order.delivery_phone})</span>}
                                            </div>
                                        )}
                                        {order.delivery_address && (
                                            <div className="pos-order-card__address">
                                                📍 {order.delivery_address}
                                            </div>
                                        )}
                                    </div>
                                    <div className="pos-order-card__actions">
                                        <Button
                                            variant="success"
                                            size="sm"
                                            disabled={!canCollectDelivery}
                                            onClick={() => openCollectDialog(order)}
                                        >
                                            {t('pos.pendingOrders.collectBtn')}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            {/* Collection Dialog */}
            <Modal
                isOpen={!!collectingOrder}
                onClose={closeCollectDialog}
                title={t('pos.pendingOrders.collectTitle')}
            >
                {collectingOrder && (
                    <div className="collect-dialog">
                        <div className="collect-dialog__summary">
                            <div className="collect-row">
                                <span>{t('pos.orderNumber')}</span>
                                <strong>{collectingOrder.order_number}</strong>
                            </div>
                            <div className="collect-row">
                                <span>{t('pos.pendingOrders.orderTotal')}</span>
                                <strong className="text-xl">{formatCurrency(collectingOrder.total)}</strong>
                            </div>
                        </div>

                        <div className="payment-mode-selector">
                            <label className="payment-mode-selector__label">{t('pos.paymentMethod.label')}</label>
                            <div className="payment-mode-selector__options">
                                {paymentMethods.map((method) => (
                                    <button
                                        key={method}
                                        type="button"
                                        className={`payment-mode-btn ${collectionPaymentMethod === method ? 'active' : ''}`}
                                        onClick={() => setCollectionPaymentMethod(method)}
                                    >
                                        {t(`pos.paymentMethod.${method}`)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        <div className="collect-dialog__actions">
                            <Button
                                variant="success"
                                className="w-full h-12 text-lg"
                                disabled={!canCollectDelivery}
                                isLoading={isCollecting}
                                onClick={handleCollect}
                            >
                                {t('pos.pendingOrders.confirmCollect')}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
};

import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { useCurrencyFormatter } from '../../hooks/useCurrencyFormatter';
import { Order } from '../../types/orders';

interface SalesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onInitiateReturn: (orderNumber: string) => void;
    sessionId?: string;
}

export const SalesDrawer: React.FC<SalesDrawerProps> = ({ isOpen, onClose, onInitiateReturn, sessionId }) => {
    const { t } = useTranslation();
    const api = useApi();
    const { formatCurrency } = useCurrencyFormatter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            const sessionParam = sessionId ? `&sessionId=${sessionId}` : '';
            api<{ items: Order[] }>(`/pos/orders?pageSize=50${sessionParam}`)
                .then((data: { items: Order[] }) => setOrders(data.items || []))
                .catch((err: any) => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, api, sessionId]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('pos.salesDrawer.title')}
        >
            <div className="pos-drawer-content">
                {loading ? (
                    <div className="pos-loading">{t('common.loading')}</div>
                ) : orders.length === 0 ? (
                    <div className="pos-empty">{t('pos.salesDrawer.empty')}</div>
                ) : (
                    <table className="pos-table">
                        <thead>
                            <tr>
                                <th>{t('pos.salesDrawer.orderNumber')}</th>
                                <th>{t('pos.salesDrawer.type')}</th>
                                <th>{t('pos.salesDrawer.status')}</th>
                                <th>{t('pos.salesDrawer.total')}</th>
                                <th>{t('pos.salesDrawer.date')}</th>
                                <th>{t('pos.salesDrawer.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((order) => {
                                const hasDiscount = order.discount_amount && order.discount_amount > 0;
                                return (
                                    <tr key={order.id} style={hasDiscount ? { backgroundColor: '#fef2f2', color: '#ef4444' } : {}}>
                                        <td>
                                            <strong>{order.order_number}</strong>
                                            {hasDiscount && <span style={{ marginLeft: '4px', fontSize: '0.75rem', padding: '2px 4px', background: '#fee2e2', borderRadius: '4px' }}>%</span>}
                                        </td>
                                    <td>
                                        <span className={`badge-type badge-${order.order_type}`}>
                                            {t(`pos.orderType.${order.order_type || 'DINE_IN'}`)}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge-status badge-${order.status}`}>
                                            {t(`pos.status.${order.status}`)}
                                        </span>
                                    </td>
                                    <td>{formatCurrency(order.total_amount)}</td>
                                    <td>{new Date(order.created_at).toLocaleTimeString()}</td>
                                    <td>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => onInitiateReturn(order.order_number)}
                                            className="pos-return-btn"
                                        >
                                            {t('pos.salesDrawer.returnBtn')}
                                        </Button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </Modal>
    );
};

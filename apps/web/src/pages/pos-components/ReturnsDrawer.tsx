import React, { useState, useEffect } from 'react';
import { Modal, Button } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { useCurrencyFormatter } from '../../hooks/useCurrencyFormatter';
import { ReturnRecord } from '../../types/orders';
import { usePOS } from '../../context/POSContext';

interface ReturnsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateReturn: () => void;
}

export const ReturnsDrawer: React.FC<ReturnsDrawerProps> = ({ isOpen, onClose, onCreateReturn }) => {
    const { t } = useTranslation();
    const api = useApi();
    const { formatCurrency } = useCurrencyFormatter();
    const { session } = usePOS();
    const [returns, setReturns] = useState<ReturnRecord[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLoading(true);
            const sessionParam = session?.id ? `?sessionId=${session.id}` : '';
            api<{ items: ReturnRecord[] }>(`/pos/returns${sessionParam}`)
                .then((data: { items: ReturnRecord[] }) => setReturns(data.items || []))
                .catch((err: any) => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [isOpen, api, session?.id]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={t('pos.returnsDrawer.title')}
        >
            <div className="pos-drawer-header">
                <Button onClick={onCreateReturn} variant="primary">
                    {t('pos.processReturn')}
                </Button>
            </div>
            <div className="pos-drawer-content">
                {loading ? (
                    <div className="pos-loading">{t('common.loading')}</div>
                ) : returns.length === 0 ? (
                    <div className="pos-empty">{t('pos.returnsDrawer.empty')}</div>
                ) : (
                    <table className="pos-table">
                        <thead>
                            <tr>
                                <th>{t('pos.returnsDrawer.orderNumber')}</th>
                                <th>{t('pos.returnsDrawer.reason')}</th>
                                <th>{t('pos.returnsDrawer.refund')}</th>
                                <th>{t('pos.returnsDrawer.cashier')}</th>
                                <th>{t('pos.returnsDrawer.date')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {returns.map((ret) => (
                                <tr key={ret.id}>
                                    <td><strong>{ret.order_number}</strong></td>
                                    <td>{ret.reason}</td>
                                    <td className="text-destructive">-{formatCurrency(ret.total_refund)}</td>
                                    <td>{ret.cashier_name}</td>
                                    <td>{new Date(ret.created_at).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </Modal>
    );
};

import React from 'react';
import { Button } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { usePOS } from '../../context/POSContext';
import { useCan } from '../../hooks/useCan';
import { PERMISSIONS } from '../../lib/permissions';

interface POSToolbarProps {
    onSaveOrder: () => void;
    onOpenSales: () => void;
    onOpenReturns: () => void;
    onOpenPending: () => void;
    onPrintLast: () => void;
    onSendKitchen: () => void;
    onCashIn: () => void;
    onCashOut: () => void;
    isSubmitting: boolean;
    lastOrder: any;
}

export const POSToolbar: React.FC<POSToolbarProps> = ({
    onSaveOrder,
    onOpenSales,
    onOpenReturns,
    onOpenPending,
    onPrintLast,
    onSendKitchen,
    onCashIn,
    onCashOut,
    isSubmitting,
    lastOrder
}) => {
    const { t } = useTranslation();
    const { cart, orderType } = usePOS();
    const canSale = useCan(PERMISSIONS.POS_SALE);
    const canReturns = useCan(undefined, [PERMISSIONS.POS_RETURN_CREATE, PERMISSIONS.POS_RETURNS]);
    const canPrint = useCan(PERMISSIONS.POS_ORDER_PRINT);
    const canCashIn = useCan(PERMISSIONS.POS_CASH_IN);
    const canCashOut = useCan(PERMISSIONS.POS_CASH_OUT);

    return (
        <div className="pos-toolbar">
            <div className="pos-toolbar__actions">
                <Button
                    variant="primary"
                    disabled={cart.length === 0 || isSubmitting || !canSale}
                    onClick={onSaveOrder}
                    isLoading={isSubmitting}
                >
                    {orderType === 'DELIVERY' ? t('pos.toolbar.saveDelivery') : t('pos.toolbar.save')}
                </Button>

                <Button
                    variant="secondary"
                    disabled={!lastOrder || isSubmitting || !canPrint}
                    onClick={onPrintLast}
                    isLoading={isSubmitting && !!lastOrder}
                >
                    {t('pos.toolbar.print')}
                </Button>

                <Button
                    variant="secondary"
                    disabled={!lastOrder || isSubmitting || !canPrint}
                    onClick={onSendKitchen}
                    isLoading={isSubmitting && !!lastOrder}
                >
                    {t('pos.toolbar.sendKitchen')}
                </Button>
            </div>

            <div className="pos-toolbar__drawers">
                <Button variant="ghost" onClick={onOpenSales}>
                    <span className="pos-toolbar__icon">📊</span>
                    {t('pos.toolbar.sales')}
                </Button>

                {canReturns && (
                    <Button variant="ghost" onClick={onOpenReturns}>
                        <span className="pos-toolbar__icon">↩️</span>
                        {t('pos.toolbar.returns')}
                    </Button>
                )}

                <Button variant="ghost" onClick={onOpenPending} className="pos-toolbar__pending-btn">
                    <span className="pos-toolbar__icon">🚚</span>
                    {t('pos.toolbar.pendingDelivery')}
                </Button>

                {canCashIn && (
                    <Button variant="ghost" onClick={onCashIn}>
                        {t('pos.toolbar.cashIn')}
                    </Button>
                )}

                {canCashOut && (
                    <Button variant="ghost" onClick={onCashOut}>
                        {t('pos.toolbar.cashOut')}
                    </Button>
                )}
            </div>
        </div>
    );
};

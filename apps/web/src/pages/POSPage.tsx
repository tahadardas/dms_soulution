import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Button, Card, Input, Modal, POSLayout, useToast } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useCurrencyFormatter } from '../hooks/useCurrencyFormatter';
import { useNavigate } from 'react-router-dom';
import { usePOS, CartItem } from '../context/POSContext';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { getFallbackPathForRole } from '../routes';
import PermissionGate from '../components/PermissionGate';
import { PERMISSIONS } from '../lib/permissions';
import { useCan } from '../hooks/useCan';
import { useKey } from 'react-use';

import { POSToolbar } from './pos-components/POSToolbar';
import { CartPanel } from './pos-components/CartPanel';
import { SalesDrawer } from './pos-components/SalesDrawer';
import { ReturnsDrawer } from './pos-components/ReturnsDrawer';
import { PendingDeliveryDrawer } from './pos-components/PendingDeliveryDrawer';
import { POSHeader } from './pos-components/POSHeader';
import { POSStatusBar } from './pos-components/POSStatusBar';
import { OrderPad } from './pos-components/OrderPad';
import { LineNoteModal } from './pos-components/LineNoteModal';

import '../styles/POSPage.css';

export const POSPage: React.FC = () => {
    const { 
        session, addToCart, submitOrder, openSession, closeSession, 
        lastOrder, updateItemNote 
    } = usePOS();
    const { formatCurrency } = useCurrencyFormatter();
    const { user, logout } = useAuth();
    const api = useApi();
    const toast = useToast();
    const navigate = useNavigate();
    const { t } = useTranslation();
    
    const canReturns = useCan(undefined, [PERMISSIONS.POS_RETURN_CREATE, PERMISSIONS.POS_RETURNS]);
    const canCloseSession = useCan(PERMISSIONS.POS_CLOSE_SESSION);
    const canPrintOrder = useCan(PERMISSIONS.POS_ORDER_PRINT);

    const [openingCash, setOpeningCash] = useState('0');
    const [closingCash, setClosingCash] = useState('0');
    const [closingNotes, setClosingNotes] = useState('');
    const [closingReason, setClosingReason] = useState('');
    const [closingManagerUsername, setClosingManagerUsername] = useState('');
    const [closingManagerPassword, setClosingManagerPassword] = useState('');
    const [showReturns, setShowReturns] = useState(false);
    const [showCloseSession, setShowCloseSession] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [returnQuery, setReturnQuery] = useState('');
    const [returnOrder, setReturnOrder] = useState<any>(null);
    const [returnReason, setReturnReason] = useState('');
    const [returnItems, setReturnItems] = useState<Record<number, number>>({});
    const [returnLoading, setReturnLoading] = useState(false);
    const [lineNoteModalOpen, setLineNoteModalOpen] = useState(false);
    const [lineNoteItem, setLineNoteItem] = useState<CartItem | null>(null);
    const [showSalesDrawer, setShowSalesDrawer] = useState(false);
    const [showReturnsDrawer, setShowReturnsDrawer] = useState(false);
    const [showPendingDrawer, setShowPendingDrawer] = useState(false);
    const [cashMovementType, setCashMovementType] = useState<'CASH_IN' | 'CASH_OUT' | null>(null);
    const [cashMovementAmount, setCashMovementAmount] = useState('');
    const [cashMovementReason, setCashMovementReason] = useState('');
    const [isSavingCashMovement, setIsSavingCashMovement] = useState(false);
    const [sessionStats, setSessionStats] = useState({ 
        totalSales: 0, totalReturns: 0, totalDiscounts: 0, netAmount: 0, 
        expectedCash: 0, cashIn: 0, cashOut: 0 
    });

    const loadStats = useCallback(async () => {
        if (!session?.id) return;
        try {
            const stats = await api<any>(`/pos/sessions/${session.id}/stats`);
            setSessionStats(stats);
        } catch (err) {
            console.error('Failed to load session stats:', err);
        }
    }, [api, session?.id]);

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, [loadStats]);

    const handleEditItemNote = (item: CartItem) => {
        setLineNoteItem(item);
        setLineNoteModalOpen(true);
    };

    const handleSaveItemNote = (note: string) => {
        if (lineNoteItem) {
            updateItemNote(lineNoteItem.id, note);
        }
    };

    const handleOpenSession = async () => {
        setIsOpening(true);
        try {
            await openSession(parseFloat(openingCash) || 0);
            toast.success(t('toast.pos.sessionOpened'));
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.openFailed'));
        } finally {
            setIsOpening(false);
        }
    };

    const handleSubmitOrder = async () => {
        setIsSubmitting(true);
        try {
            const result = await submitOrder();
            if (result?.orderNumber) {
                toast.success(t('toast.pos.orderSubmitted', { orderNumber: result.orderNumber }));
            } else {
                toast.success(t('toast.pos.orderSubmittedGeneric'));
            }
            loadStats();
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.submitFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePrintLast = async () => {
        if (!canPrintOrder) {
            toast.error(t('errors.pos.noPrintPermission'));
            return;
        }
        if (!session || !lastOrder) {
            toast.error(t('errors.pos.noLastOrderToPrint'));
            return;
        }
        setIsSubmitting(true);
        try {
            await api(`/pos/orders/${lastOrder.orderId}/print`, {
                method: 'POST',
                body: JSON.stringify({ types: ['RECEIPT'], processNow: true })
            });
            toast.success(t('toast.pos.printJobQueued'));
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.printFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSendKitchen = async () => {
        if (!canPrintOrder) {
            toast.error(t('errors.pos.noPrintPermission'));
            return;
        }
        if (!session || !lastOrder) {
            toast.error(t('errors.pos.noLastOrderToPrint'));
            return;
        }
        setIsSubmitting(true);
        try {
            await api(`/pos/orders/${lastOrder.orderId}/print`, {
                method: 'POST',
                body: JSON.stringify({ types: ['KOT'], processNow: true })
            });
            toast.success(t('toast.pos.kitchenJobQueued'));
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.kitchenPrintFailed'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseSession = async () => {
        if (!canCloseSession) {
            toast.error(t('errors.pos.noClosePermission'));
            return;
        }
        const enteredCash = parseFloat(closingCash);
        if (isNaN(enteredCash)) {
            toast.error(t('errors.pos.invalidCash'));
            return;
        }
        const expected = sessionStats.expectedCash || 0;
        const difference = enteredCash - expected;
        if (Math.abs(difference) > 0.001 && !closingReason.trim()) {
            toast.error(t('errors.pos.cashDifferenceReasonRequired'));
            return;
        }
        setIsClosing(true);
        try {
            await closeSession(enteredCash, {
                notes: closingNotes,
                reason: closingReason,
                managerUsername: closingManagerUsername || undefined,
                managerPassword: closingManagerPassword || undefined
            });
            toast.success(t('toast.pos.sessionClosed'));
            setShowCloseSession(false);
            setClosingReason('');
            setClosingManagerUsername('');
            setClosingManagerPassword('');
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.closeFailed'));
        } finally {
            setIsClosing(false);
        }
    };

    // Keyboard Shortcuts
    useKey('F8', (e) => { e.preventDefault(); if (!isSubmitting) handleSubmitOrder(); }, {}, [isSubmitting]);
    useKey('F9', (e) => { e.preventDefault(); handlePrintLast(); }, {}, [lastOrder]);
    useKey('F10', (e) => { e.preventDefault(); handleSendKitchen(); }, {}, [lastOrder]);
    useKey('Escape', () => {
        setShowSalesDrawer(false);
        setShowReturnsDrawer(false);
        setShowPendingDrawer(false);
        setShowReturns(false);
        setShowCloseSession(false);
        setCashMovementType(null);
    });

    const openCashMovement = (type: 'CASH_IN' | 'CASH_OUT') => {
        setCashMovementType(type);
        setCashMovementAmount('');
        setCashMovementReason('');
    };

    const handleSaveCashMovement = async () => {
        if (!session || !cashMovementType) return;
        const amount = Number(cashMovementAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            toast.error(t('errors.pos.invalidCashMovementAmount'));
            return;
        }
        if (!cashMovementReason.trim()) {
            toast.error(t('errors.pos.cashMovementReasonRequired'));
            return;
        }
        setIsSavingCashMovement(true);
        try {
            await api(cashMovementType === 'CASH_IN' ? '/pos/cash-in' : '/pos/cash-out', {
                method: 'POST',
                body: JSON.stringify({ sessionId: session.id, amount, reason: cashMovementReason.trim(), method: 'CASH' })
            });
            toast.success(cashMovementType === 'CASH_IN' ? t('toast.pos.cashInSaved') : t('toast.pos.cashOutSaved'));
            setCashMovementType(null);
            loadStats();
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.cashMovementFailed'));
        } finally {
            setIsSavingCashMovement(false);
        }
    };

    const handleLoadReturnOrder = async (directOrderNumber?: string) => {
        if (!canReturns) {
            toast.error(t('errors.pos.noReturnPermission'));
            return;
        }
        const query = directOrderNumber || returnQuery.trim();
        if (!query) return;
        setReturnLoading(true);
        try {
            const data = await api<{ items: any[] }>(`/pos/orders?orderNumber=${encodeURIComponent(query)}`);
            if (!data?.items?.length) {
                toast.error(t('errors.pos.orderNotFound'));
                return;
            }
            const fullOrder = await api<any>(`/pos/orders/${data.items[0].id}`);
            setReturnOrder(fullOrder);
            setReturnItems({});
            setReturnReason('');
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.loadOrderFailed'));
        } finally {
            setReturnLoading(false);
        }
    };

    const handleSubmitReturn = async () => {
        if (!returnOrder || !session) return;
        const selected = Object.entries(returnItems)
            .filter(([_, qty]) => qty > 0)
            .map(([lineId, qty]) => ({ orderLineId: Number(lineId), quantity: qty }));
        if (selected.length === 0) {
            toast.error(t('errors.pos.noItemsSelected'));
            return;
        }
        if (!returnReason.trim()) {
            toast.error(t('errors.pos.returnReasonRequired'));
            return;
        }
        setReturnLoading(true);
        try {
            await api('/pos/returns', {
                method: 'POST',
                body: JSON.stringify({ orderId: returnOrder.id, reason: returnReason.trim(), items: selected, sessionId: session.id })
            });
            toast.success(t('toast.pos.returnProcessed'));
            loadStats();
            setShowReturns(false);
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.returnFailed'));
        } finally {
            setReturnLoading(false);
        }
    };

    const returnTotal = useMemo(() => {
        if (!returnOrder) return 0;
        return (returnOrder.lines || []).reduce((sum: number, line: any) => {
            const qty = returnItems[line.id] || 0;
            return sum + qty * line.unit_price;
        }, 0);
    }, [returnItems, returnOrder]);

    const fallbackPath = getFallbackPathForRole(user?.role);
    const showExit = fallbackPath !== '/pos';

    if (!session) {
        return (
            <div className="pos-start">
                <POSHeader
                    session={null}
                    sessionStats={{ totalSales: 0, totalReturns: 0, totalDiscounts: 0, netAmount: 0, expectedCash: 0, cashIn: 0, cashOut: 0 }}
                    onLogout={logout}
                    onExit={() => navigate(fallbackPath)}
                    showExit={showExit}
                    onSettings={() => {}}
                    onCloseSession={() => {}}
                    formatCurrency={formatCurrency}
                />
                <div className="pos-start__container">
                    <Card className="pos-start__card" padding="lg">
                        <div className="pos-start__header">
                            <h1>{t('pos.title')}</h1>
                            <p>{t('pos.noSession')}</p>
                        </div>
                        <div className="pos-start__body">
                            <Input label={t('pos.openingCash')} type="number" value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
                            <PermissionGate perm={PERMISSIONS.POS_SALE} tooltip={t('errors.pos.noOpenPermission')}>
                                <Button size="lg" isLoading={isOpening} onClick={handleOpenSession}>{t('pos.startSession')}</Button>
                            </PermissionGate>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <POSLayout
            header={
                <div className="pos-header-container">
                    <POSHeader
                        session={session}
                        sessionStats={sessionStats}
                        onLogout={logout}
                        onExit={() => navigate(fallbackPath)}
                        showExit={showExit}
                        onSettings={() => {}}
                        onCloseSession={() => setShowCloseSession(true)}
                        formatCurrency={formatCurrency}
                    />
                    <POSToolbar 
                        onSaveOrder={handleSubmitOrder}
                        onOpenSales={() => setShowSalesDrawer(true)}
                        onOpenReturns={() => setShowReturnsDrawer(true)}
                        onOpenPending={() => setShowPendingDrawer(true)}
                        onPrintLast={handlePrintLast}
                        onSendKitchen={handleSendKitchen}
                        onCashIn={() => openCashMovement('CASH_IN')}
                        onCashOut={() => openCashMovement('CASH_OUT')}
                        isSubmitting={isSubmitting}
                        lastOrder={lastOrder}
                    />
                    <POSStatusBar />
                </div>
            }
        >
            <div className="dms-pos-layout__content">
                <Card className="pos-panel" padding="md">
                    <OrderPad onAdd={addToCart} formatCurrency={formatCurrency} />
                </Card>
                <Card className="pos-panel" padding="md">
                    <CartPanel onEditItemNote={handleEditItemNote} isSubmitting={isSubmitting} onSubmit={handleSubmitOrder} />
                </Card>
            </div>

            <LineNoteModal isOpen={lineNoteModalOpen} onClose={() => setLineNoteModalOpen(false)} item={lineNoteItem} onSave={handleSaveItemNote} />
            <SalesDrawer isOpen={showSalesDrawer} onClose={() => setShowSalesDrawer(false)} onInitiateReturn={(num) => { setShowSalesDrawer(false); setReturnQuery(num); setShowReturns(true); handleLoadReturnOrder(num); }} sessionId={session.id} />
            <ReturnsDrawer isOpen={showReturnsDrawer} onClose={() => setShowReturnsDrawer(false)} onCreateReturn={() => { setShowReturnsDrawer(false); setShowReturns(true); }} />
            <PendingDeliveryDrawer isOpen={showPendingDrawer} onClose={() => setShowPendingDrawer(false)} />

            <Modal isOpen={cashMovementType !== null} onClose={() => setCashMovementType(null)} title={cashMovementType === 'CASH_IN' ? t('pos.cashInTitle') : t('pos.cashOutTitle')}>
                <div className="pos-modal-content">
                    <Input label={t('pos.cashMovementAmount')} type="number" value={cashMovementAmount} onChange={(e) => setCashMovementAmount(e.target.value)} />
                    <Input label={t('pos.cashMovementReason')} value={cashMovementReason} onChange={(e) => setCashMovementReason(e.target.value)} />
                    <Button isLoading={isSavingCashMovement} onClick={handleSaveCashMovement}>{t('common.save')}</Button>
                </div>
            </Modal>

            <Modal isOpen={showCloseSession} onClose={() => setShowCloseSession(false)} title={t('pos.closeSessionTitle')}>
                <div className="pos-modal-content">
                    <div className="pos-close-card">
                        <div className="pos-close-row"><span>{t('pos.expectedTotal')}:</span><span>{formatCurrency(sessionStats.expectedCash)}</span></div>
                    </div>
                    <Input label={t('pos.closingCash')} type="number" value={closingCash} onChange={(e) => setClosingCash(e.target.value)} />
                    <Input label={t('pos.closingNotes')} multiline value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} />
                    <Button variant="danger" isLoading={isClosing} onClick={handleCloseSession}>{t('pos.closeSession')}</Button>
                </div>
            </Modal>

            <Modal isOpen={showReturns} onClose={() => setShowReturns(false)} title={t('pos.processReturn')}>
                <div className="pos-modal-content">
                    <Input label={t('pos.orderNumber')} value={returnQuery} onChange={(e) => setReturnQuery(e.target.value)} />
                    <Button onClick={() => handleLoadReturnOrder()} disabled={returnLoading}>{t('pos.loadOrder')}</Button>
                    {returnOrder && (
                        <div className="pos-return">
                            <div className="pos-return__lines">
                                {returnOrder.lines.map((line: any) => (
                                    <div key={line.id} className="pos-return-line">
                                        <span>{line.product_name}</span>
                                        <Input type="number" value={String(returnItems[line.id] || '')} onChange={(e) => setReturnItems(prev => ({ ...prev, [line.id]: Number(e.target.value) }))} />
                                    </div>
                                ))}
                            </div>
                            <Button variant="danger" isLoading={returnLoading} onClick={handleSubmitReturn}>{t('pos.issueRefund')} ({formatCurrency(returnTotal)})</Button>
                        </div>
                    )}
                </div>
            </Modal>
        </POSLayout>
    );
};

export default POSPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Modal, POSLayout, PageHeader, Switch, useToast } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useCurrencyFormatter } from '../hooks/useCurrencyFormatter';
import { useNavigate } from 'react-router-dom';
import { usePOS, Product, CartItem } from '../context/POSContext';
import { useApi } from '../hooks/useApi';
import { useAppConfig } from '../context/AppConfigContext';
import { useAuth } from '../context/AuthContext';
import { BackButton } from '../components/BackButton';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { getFallbackPathForRole } from '../routes';
import PermissionGate from '../components/PermissionGate';
import { PERMISSIONS } from '../lib/permissions';
import { useCan } from '../hooks/useCan';

import { POSToolbar } from './pos-components/POSToolbar';
import { CartPanel } from './pos-components/CartPanel';
import { SalesDrawer } from './pos-components/SalesDrawer';
import { ReturnsDrawer } from './pos-components/ReturnsDrawer';
import { PendingDeliveryDrawer } from './pos-components/PendingDeliveryDrawer';
import { ProductCategoryTabs } from './pos-components/ProductCategoryTabs';
import { POSHeader } from './pos-components/POSHeader';
import { POSStatusBar } from './pos-components/POSStatusBar';
import '../styles/POSPage.css';

const PAGE_SIZE = 24;

type ProductCategory = {
    id: number;
    name: string;
    color?: string | null;
    is_active?: boolean | number | null;
};

const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;
    return (
        <>
            {text.slice(0, index)}
            <mark className="pos-highlight">{text.slice(index, index + query.length)}</mark>
            {text.slice(index + query.length)}
        </>
    );
};

const OrderPad = ({
    onAdd,
    formatCurrency
}: {
    onAdd: (p: Product) => void;
    formatCurrency: (value: number) => string;
}) => {
    const api = useApi();
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [categoriesLoading, setCategoriesLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, selectedCategoryId]);

    useEffect(() => {
        const loadCategories = async () => {
            setCategoriesLoading(true);
            try {
                const data = await api<{ items: ProductCategory[] }>('/inventory/categories');
                const activeCategories = (data.items || []).filter(category => category.is_active !== false && category.is_active !== 0);
                setCategories(activeCategories);
                setSelectedCategoryId(currentCategoryId => {
                    if (currentCategoryId && activeCategories.some(category => category.id === currentCategoryId)) {
                        return currentCategoryId;
                    }
                    return activeCategories[0]?.id ?? null;
                });
            } catch (err: any) {
                console.error('Failed to load categories:', err);
                setCategories([]);
                setSelectedCategoryId(null);
            } finally {
                setCategoriesLoading(false);
            }
        };
        loadCategories();
    }, [api]);

    const [inventorySettings, setInventorySettings] = useState<any>({});

    useEffect(() => {
        let mounted = true;
        api<any>('/settings/inventory')
            .then(data => { if (mounted && data) setInventorySettings(data); })
            .catch(() => {});
        return () => { mounted = false; };
    }, [api]);

    useEffect(() => {
        const loadProducts = async () => {
            if (categoriesLoading) {
                return;
            }
            if (categories.length > 0 && selectedCategoryId === null) {
                setProducts([]);
                setTotal(0);
                return;
            }
            // Only block short searches if there IS a search. If empty, show all (or filtered by category).
            if (debouncedSearch.length === 1) {
                setProducts([]);
                setTotal(0);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const categoryParam = selectedCategoryId !== null ? `&categoryId=${selectedCategoryId}` : '';
                const data = await api<{ items: Product[]; total: number }>(
                    `/pos/products?search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${PAGE_SIZE}${categoryParam}`
                );
                setProducts(prev => (page === 1 ? data.items : [...prev, ...data.items]));
                setTotal(data.total || 0);
            } catch (err: any) {
                setError(err?.message || t('errors.pos.loadProductsFailed'));
            } finally {
                setLoading(false);
            }
        };

        loadProducts();
    }, [api, categories.length, categoriesLoading, debouncedSearch, page, selectedCategoryId, t]);

    const canLoadMore = products.length < total;

    return (
        <div className="pos-order-pad">
            <div className="pos-search">
                <Input
                    label={t('pos.productSearchLabel')}
                    placeholder={t('pos.productSearchPlaceholder')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </div>

            <ProductCategoryTabs
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onChange={setSelectedCategoryId}
                isLoading={categoriesLoading}
            />

            {error && <div className="pos-inline-error">{error}</div>}
            {debouncedSearch.length > 0 && debouncedSearch.length < 2 && (
                <div className="pos-empty">{t('pos.searchMinHint')}</div>
            )}
            <div className="pos-product-grid">
                {loading && products.length === 0 && <div className="pos-empty">{t('pos.loadingProducts')}</div>}
                {!loading && products.length === 0 && (
                    <div className="pos-empty">
                        {debouncedSearch.length >= 2 
                            ? t('pos.noProductsMatch', 'No products match your search') 
                            : t('pos.noProductsInCategory', 'No products found in this category')}
                    </div>
                )}
                {products.map((product) => {
                    const isOutOfStock = product.stock_quantity != null && product.stock_quantity <= 0;
                    const showStock = product.stock_quantity != null;
                    const isRecipe = product.type === 'RECIPE' || product.type === 'COMBO';

                    return (
                        <button
                            key={product.id}
                            className={`pos-product-tile ${isOutOfStock ? 'pos-product-tile--oos' : ''}`}
                            onClick={() => onAdd(product)}
                            disabled={isOutOfStock && !inventorySettings.allowNegativeStock}
                        >
                            {isRecipe && (
                                <span className="pos-product-badge pos-product-badge--recipe">
                                    {product.type === 'COMBO' ? t('pos.type.combo', 'Combo') : t('pos.type.recipe', 'Recipe')}
                                </span>
                            )}
                            {isOutOfStock && (
                                <span className="pos-product-badge pos-product-badge--oos">
                                    {t('inventory.outOfStock', 'OOS')}
                                </span>
                            )}
                            <div className="pos-product-tile__content">
                                <span className="pos-product-name">{highlightMatch(product.name, debouncedSearch)}</span>
                                <div className="pos-product-tile__footer">
                                    <span className="pos-product-price">{formatCurrency(product.price)}</span>
                                    {showStock && (
                                        <span className={`pos-product-stock ${(product.stock_quantity ?? 0) < (product.min_stock_level || 5) ? 'pos-product-stock--low' : ''}`}>
                                            {product.stock_quantity}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
                {canLoadMore && (
                    <div className="pos-load-more">
                        <Button
                            variant="secondary"
                            onClick={() => setPage(p => p + 1)}
                            isLoading={loading}
                        >
                            {t('common.loadMore')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

const QUICK_NOTES = [
    { key: 'no-spicy', en: 'No Spicy', ar: 'بدون شطة' },
    { key: 'extra-cheese', en: 'Extra Cheese', ar: 'جبنة زيادة' },
    { key: 'well-done', en: 'Well Done', ar: 'مطبوخ جيداً' },
    { key: 'no-onions', en: 'No Onions', ar: 'بدون بصل' }
];

const LineNoteModal = ({
    isOpen,
    onClose,
    item,
    onSave
}: {
    isOpen: boolean;
    onClose: () => void;
    item: CartItem | null;
    onSave: (note: string) => void;
}) => {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.dir() === 'rtl';
    const [noteText, setNoteText] = useState('');

    useEffect(() => {
        if (item) setNoteText(item.note || '');
    }, [item, isOpen]);

    const handleChipClick = (chipText: string) => {
        setNoteText((prev) => {
            if (prev) return `${prev}, ${chipText}`;
            return chipText;
        });
    };

    const handleSave = () => {
        onSave(noteText);
        onClose();
    };

    if (!item) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('pos.lineNote', 'Item Note')}>
            <div className="pos-line-note-modal">
                <p className="pos-line-note-modal__product">{item.name}</p>
                <textarea
                    className="pos-line-note-modal__textarea"
                    placeholder={t('pos.lineNotePlaceholder', 'Add a note...')}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={3}
                    dir={isRTL ? 'rtl' : 'ltr'}
                />
                <div className="pos-line-note-modal__chips">
                    {QUICK_NOTES.map((chip) => (
                        <button
                            key={chip.key}
                            type="button"
                            className="pos-chip"
                            onClick={() => handleChipClick(isRTL ? chip.ar : chip.en)}
                        >
                            {isRTL ? chip.ar : chip.en}
                        </button>
                    ))}
                </div>
                <div className="pos-line-note-modal__actions">
                    <Button variant="secondary" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" onClick={handleSave}>
                        {t('common.save')}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export const POSPage: React.FC = () => {
    const { 
        session, addToCart, submitOrder, openSession, closeSession, 
        lastOrder, updateItemNote, clearCart 
    } = usePOS();
    const { formatCurrency, locale } = useCurrencyFormatter();
    const { apiUrl, kioskMode, saveConfig } = useAppConfig();
    const { user, logout } = useAuth();
    const api = useApi();
    const toast = useToast();
    const navigate = useNavigate();
    const { goBack } = useBackNavigation();
    const { t } = useTranslation();
    const canReturns = useCan(undefined, [PERMISSIONS.POS_RETURN_CREATE, PERMISSIONS.POS_RETURNS]);
    const canCloseSession = useCan(PERMISSIONS.POS_CLOSE_SESSION);
    const canPrintOrder = useCan(PERMISSIONS.POS_ORDER_PRINT);

    const [posSettings, setPosSettings] = useState<any>({ shortcuts: {} });

    useEffect(() => {
        let mounted = true;
        api<any>('/settings/pos')
            .then(data => { if (mounted && data) setPosSettings(data); })
            .catch(() => {});
        return () => { mounted = false; };
    }, [api]);

    const [openingCash, setOpeningCash] = useState('0');
    const [closingCash, setClosingCash] = useState('0');
    const [closingNotes, setClosingNotes] = useState('');
    const [closingReason, setClosingReason] = useState('');
    const [closingManagerUsername, setClosingManagerUsername] = useState('');
    const [closingManagerPassword, setClosingManagerPassword] = useState('');
    const [showReturns, setShowReturns] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showCloseSession, setShowCloseSession] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    const [localConfig, setLocalConfig] = useState({ apiUrl, kioskMode });

    const [returnQuery, setReturnQuery] = useState('');
    const [returnOrder, setReturnOrder] = useState<any>(null);
    const [returnReason, setReturnReason] = useState('');
    const [returnItems, setReturnItems] = useState<Record<number, number>>({});
    const [returnLoading, setReturnLoading] = useState(false);
    const [returnError, setReturnError] = useState('');

    const [lineNoteModalOpen, setLineNoteModalOpen] = useState(false);
    const [lineNoteItem, setLineNoteItem] = useState<CartItem | null>(null);
    const [showSalesDrawer, setShowSalesDrawer] = useState(false);
    const [showReturnsDrawer, setShowReturnsDrawer] = useState(false);
    const [showPendingDrawer, setShowPendingDrawer] = useState(false);
    const [cashMovementType, setCashMovementType] = useState<'CASH_IN' | 'CASH_OUT' | null>(null);
    const [cashMovementAmount, setCashMovementAmount] = useState('');
    const [cashMovementReason, setCashMovementReason] = useState('');
    const [isSavingCashMovement, setIsSavingCashMovement] = useState(false);
    
    const [sessionStats, setSessionStats] = useState({ totalSales: 0, totalReturns: 0, totalDiscounts: 0, netAmount: 0, expectedCash: 0, cashIn: 0, cashOut: 0 });

    const loadStats = async () => {
        if (!session?.id) return;
        try {
            const stats = await api<any>(`/pos/sessions/${session.id}/stats`);
            setSessionStats(stats);
        } catch (err) {
            console.error('Failed to load session stats:', err);
        }
    };

    useEffect(() => {
        loadStats();
        const interval = setInterval(loadStats, 30000);
        return () => clearInterval(interval);
    }, [api, session?.id]);

    const handleEditItemNote = (item: CartItem) => {
        setLineNoteItem(item);
        setLineNoteModalOpen(true);
    };

    const handleSaveItemNote = (note: string) => {
        if (lineNoteItem) {
            updateItemNote(lineNoteItem.id, note);
        }
    };

    useEffect(() => {
        setLocalConfig({ apiUrl, kioskMode });
    }, [apiUrl, kioskMode]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if (event.altKey && event.key === 'ArrowLeft') {
                event.preventDefault();
                goBack();
            }
        };
        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, [goBack]);

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
            loadStats(); // Refresh stats after order
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
            toast.error(t('errors.pos.invalidCash', 'Invalid cash amount.'));
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

    const handleSaveSettings = async () => {
        try {
            await saveConfig(localConfig);
            toast.success(t('toast.pos.settingsSaved'));
            setShowSettings(false);
        } catch (err: any) {
            toast.error(err?.message || t('errors.pos.settingsSaveFailed'));
        }
    };

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
                body: JSON.stringify({
                    sessionId: session.id,
                    amount,
                    reason: cashMovementReason.trim(),
                    method: 'CASH'
                })
            });
            toast.success(cashMovementType === 'CASH_IN' ? t('toast.pos.cashInSaved') : t('toast.pos.cashOutSaved'));
            setCashMovementType(null);
            setCashMovementAmount('');
            setCashMovementReason('');
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
        setReturnError('');
        try {
            const data = await api<{ items: any[] }>(`/pos/orders?orderNumber=${encodeURIComponent(query)}`);
            if (!data?.items?.length) {
                setReturnError(t('errors.pos.orderNotFound'));
                return;
            }
            const order = data.items[0];
            const fullOrder = await api<any>(`/pos/orders/${order.id}`);
            setReturnOrder(fullOrder);
            setReturnItems({});
            setReturnReason('');
        } catch (err: any) {
            setReturnError(err?.message || t('errors.pos.loadOrderFailed'));
        } finally {
            setReturnLoading(false);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const shortcuts = posSettings.shortcuts;
            if (!shortcuts) return;

            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            const key = e.key.toLowerCase();
            
            if (key === (shortcuts.saveOrder || 'f12').toLowerCase()) {
                e.preventDefault();
                handleSubmitOrder();
            } else if (key === (shortcuts.printReceipt || 'f10').toLowerCase()) {
                e.preventDefault();
                handlePrintLast();
            } else if (key === (shortcuts.printKOT || 'f9').toLowerCase()) {
                e.preventDefault();
                handleSendKitchen();
            } else if (key === (shortcuts.clearCart || 'f5').toLowerCase()) {
                e.preventDefault();
                if (window.confirm(t('pos.confirmClearCart', 'Are you sure you want to clear the cart?'))) {
                    clearCart();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [posSettings.shortcuts, handleSubmitOrder, handlePrintLast, handleSendKitchen, clearCart, t]);

    const handleInitiateReturnFromSales = (orderNumber: string) => {
        setShowSalesDrawer(false);
        setReturnQuery(orderNumber);
        setShowReturns(true);
        handleLoadReturnOrder(orderNumber);
    };

    const handleSubmitReturn = async () => {
        if (!returnOrder || !session) return;
        const selected = Object.entries(returnItems)
            .filter(([_, qty]) => qty > 0)
            .map(([lineId, qty]) => ({ orderLineId: Number(lineId), quantity: qty }));
        
        if (selected.length === 0) {
            setReturnError(t('errors.pos.noItemsSelected'));
            return;
        }
        if (!returnReason.trim()) {
            setReturnError(t('errors.pos.returnReasonRequired'));
            return;
        }
        const confirmText = t('pos.confirmRefund', { count: selected.length, total: formatCurrency(returnTotal) });
        if (!window.confirm(confirmText)) {
            return;
        }
        setReturnLoading(true);
        setReturnError('');
        try {
            await api('/pos/returns', {
                method: 'POST',
                body: JSON.stringify({
                    orderId: returnOrder.id,
                    reason: returnReason.trim(),
                    items: selected,
                    sessionId: session.id
                })
            });
            toast.success(t('toast.pos.returnProcessed'));
            loadStats(); // Refresh stats after return
            setShowReturns(false);
            setReturnOrder(null);
            setReturnQuery('');
            setReturnReason('');
            setReturnItems({});
        } catch (err: any) {
            setReturnError(err?.message || t('errors.pos.returnFailed'));
        } finally {
            setReturnLoading(false);
        }
    };

    const fallbackPath = getFallbackPathForRole(user?.role);
    const showExit = fallbackPath !== '/pos';

    const returnTotal = useMemo(() => {
        if (!returnOrder) return 0;
        return (returnOrder.lines || []).reduce((sum: number, line: any) => {
            const qty = returnItems[line.id] || 0;
            return sum + qty * line.unit_price;
        }, 0);
    }, [returnItems, returnOrder]);

    if (!session) {
        return (
            <div className="pos-start">
                <PageHeader
                    title={t('pos.title')}
                    subtitle={t('pos.subtitle')}
                    backButton={<BackButton />}
                    actions={
                        <Button variant="ghost" size="sm" onClick={logout}>
                            🚪 {t('nav.topbar.signOut', 'Sign Out')}
                        </Button>
                    }
                />
                <Card className="pos-start__card" padding="lg">
                    <div className="pos-start__header">
                        <h1 className="pos-start__title">{t('pos.title')}</h1>
                        <p className="pos-start__subtitle">{t('pos.noSession')}</p>
                    </div>
                    <div className="pos-start__body">
                        <Input
                            label={t('pos.openingCash')}
                            type="number"
                            value={openingCash}
                            onChange={(event) => setOpeningCash(event.target.value)}
                        />
                        <PermissionGate
                            perm={PERMISSIONS.POS_SALE}
                            tooltip={t('errors.pos.noOpenPermission')}
                        >
                            <Button size="lg" isLoading={isOpening} onClick={handleOpenSession}>
                                {t('pos.startSession')}
                            </Button>
                        </PermissionGate>
                        <Button variant="secondary" onClick={() => setShowSettings(true)}>
                            {t('pos.stationSettings')}
                        </Button>
                        {showExit && (
                            <Button variant="ghost" onClick={() => navigate(fallbackPath)}>
                                {t('nav.routes.dashboard.title', 'Back to Home')}
                            </Button>
                        )}
                    </div>
                </Card>

                <Modal
                    isOpen={showSettings}
                    onClose={() => setShowSettings(false)}
                    title={t('pos.stationSettings')}
                    footer={
                        <div className="pos-modal-actions">
                            <Button variant="secondary" onClick={() => setShowSettings(false)}>
                                {t('common.cancel')}
                            </Button>
                            <Button onClick={handleSaveSettings}>{t('pos.saveSettings')}</Button>
                        </div>
                    }
                >
                    <div className="pos-modal-content">
                        <Input
                            label={t('pos.apiBaseUrl')}
                            value={localConfig.apiUrl}
                            onChange={(event) => setLocalConfig(prev => ({ ...prev, apiUrl: event.target.value }))}
                        />
                        <div className="pos-setting-row">
                            <div>
                                <div className="pos-setting-title">{t('pos.kioskMode')}</div>
                                <div className="pos-setting-subtitle">{t('pos.kioskHint')}</div>
                            </div>
                            <Switch
                                checked={localConfig.kioskMode}
                                onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, kioskMode: checked }))}
                            />
                        </div>
                    </div>
                </Modal>
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
                        onSettings={() => setShowSettings(true)}
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
                    <CartPanel
                        onEditItemNote={handleEditItemNote}
                        isSubmitting={isSubmitting}
                        onSubmit={handleSubmitOrder}
                    />
                </Card>
            </div>

            <LineNoteModal
                isOpen={lineNoteModalOpen}
                onClose={() => setLineNoteModalOpen(false)}
                item={lineNoteItem}
                onSave={handleSaveItemNote}
            />

            <SalesDrawer 
                isOpen={showSalesDrawer} 
                onClose={() => setShowSalesDrawer(false)} 
                onInitiateReturn={handleInitiateReturnFromSales}
                sessionId={session.id}
            />

            <ReturnsDrawer 
                isOpen={showReturnsDrawer} 
                onClose={() => setShowReturnsDrawer(false)}
                onCreateReturn={() => {
                    setShowReturnsDrawer(false);
                    setShowReturns(true);
                }}
            />

            <PendingDeliveryDrawer 
                isOpen={showPendingDrawer} 
                onClose={() => setShowPendingDrawer(false)} 
            />

            <Modal
                isOpen={cashMovementType !== null}
                onClose={() => setCashMovementType(null)}
                title={cashMovementType === 'CASH_IN' ? t('pos.cashInTitle') : t('pos.cashOutTitle')}
                footer={
                    <div className="pos-modal-actions">
                        <Button variant="secondary" onClick={() => setCashMovementType(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button isLoading={isSavingCashMovement} onClick={handleSaveCashMovement}>
                            {t('common.save')}
                        </Button>
                    </div>
                }
            >
                <div className="pos-modal-content">
                    <Input
                        label={t('pos.cashMovementAmount')}
                        type="number"
                        value={cashMovementAmount}
                        onChange={(event) => setCashMovementAmount(event.target.value)}
                    />
                    <Input
                        label={t('pos.cashMovementReason')}
                        placeholder={t('pos.cashMovementReasonPlaceholder')}
                        value={cashMovementReason}
                        onChange={(event) => setCashMovementReason(event.target.value)}
                    />
                </div>
            </Modal>

            <Modal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                title={t('pos.stationSettings')}
                footer={
                    <div className="pos-modal-actions">
                        <Button variant="secondary" onClick={() => setShowSettings(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleSaveSettings}>{t('pos.saveSettings')}</Button>
                    </div>
                }
            >
                <div className="pos-modal-content">
                    <Input
                        label={t('pos.apiBaseUrl')}
                        value={localConfig.apiUrl}
                        onChange={(event) => setLocalConfig(prev => ({ ...prev, apiUrl: event.target.value }))}
                    />
                    <div className="pos-setting-row">
                        <div>
                            <div className="pos-setting-title">{t('pos.kioskMode')}</div>
                            <div className="pos-setting-subtitle">{t('pos.kioskHint')}</div>
                        </div>
                        <Switch
                            checked={localConfig.kioskMode}
                            onCheckedChange={(checked) => setLocalConfig(prev => ({ ...prev, kioskMode: checked }))}
                        />
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showCloseSession}
                onClose={() => setShowCloseSession(false)}
                title={t('pos.closeSessionTitle')}
                footer={
                    <div className="pos-modal-actions">
                        <Button variant="secondary" onClick={() => setShowCloseSession(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="danger" isLoading={isClosing} onClick={handleCloseSession}>
                            {t('pos.closeSession')}
                        </Button>
                    </div>
                }
            >
                <div className="pos-modal-content">
                    <div className="pos-close-summary">
                        <div className="pos-close-card">
                            <div className="pos-close-row">
                                <span className="pos-close-row__label">{t('pos.openingCash')}:</span>
                                <span className="pos-close-row__value">{formatCurrency((sessionStats as any).openingCash || 0)}</span>
                            </div>
                            <div className="pos-close-row">
                                <span className="pos-close-row__label">{t('pos.netCashFlow')}:</span>
                                <span className="pos-close-row__value">{formatCurrency((sessionStats as any).netCashFlow || 0)}</span>
                            </div>
                            <div className="pos-close-row pos-close-row--total">
                                <span className="pos-close-row__label">{t('pos.expectedTotal')}:</span>
                                <span className="pos-close-row__value">{formatCurrency(sessionStats.expectedCash)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pos-close-input-section">
                        <Input
                            label={t('pos.closingCash')}
                            type="number"
                            value={closingCash}
                            onChange={(event) => setClosingCash(event.target.value)}
                            className="pos-closing-cash-input"
                        />
                        
                        {closingCash && (
                            <div className={`pos-discrepancy-alert ${Math.abs((parseFloat(closingCash) || 0) - (sessionStats.expectedCash || 0)) < 0.01 ? 'pos-discrepancy-alert--success' : 'pos-discrepancy-alert--danger'}`}>
                                <div className="pos-discrepancy-alert__header">
                                    <span className="pos-discrepancy-alert__title">
                                        {Math.abs((parseFloat(closingCash) || 0) - (sessionStats.expectedCash || 0)) < 0.01 
                                            ? t('pos.cashBalanced', 'Cash is Balanced') 
                                            : t('pos.cashDiscrepancy', 'Cash Discrepancy Found')}
                                    </span>
                                    <span className="pos-discrepancy-alert__value">
                                        {formatCurrency((parseFloat(closingCash) || 0) - (sessionStats.expectedCash || 0))}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <Input
                        label={t('pos.closingNotes')}
                        placeholder={t('pos.closingNotesPlaceholder')}
                        value={closingNotes}
                        onChange={(event) => setClosingNotes(event.target.value)}
                    />

                    {Math.abs((parseFloat(closingCash) || 0) - (sessionStats.expectedCash || 0)) > 0.01 && (
                        <div className="pos-manager-approval-section">
                            <div className="pos-section-divider">
                                <span>{t('pos.managerApprovalRequired', 'Manager Approval Required')}</span>
                            </div>
                            <div className="pos-approval-grid">
                                <Input
                                    label={t('pos.managerUsername')}
                                    placeholder={t('pos.managerUsernamePlaceholder')}
                                    value={closingManagerUsername}
                                    onChange={(event) => setClosingManagerUsername(event.target.value)}
                                />
                                <Input
                                    label={t('pos.managerPassword')}
                                    type="password"
                                    value={closingManagerPassword}
                                    onChange={(event) => setClosingManagerPassword(event.target.value)}
                                />
                            </div>
                            <Input
                                label={t('pos.cashDifferenceReason')}
                                placeholder={t('pos.cashDifferenceReasonPlaceholder')}
                                value={closingReason}
                                onChange={(event) => setClosingReason(event.target.value)}
                            />
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={showReturns}
                onClose={() => setShowReturns(false)}
                title={t('pos.processReturn')}
                footer={
                    <div className="pos-modal-actions">
                        <Button variant="secondary" onClick={() => setShowReturns(false)}>
                            {t('common.cancel')}
                        </Button>
                        <PermissionGate
                            perms={[PERMISSIONS.POS_RETURN_CREATE, PERMISSIONS.POS_RETURNS]}
                            tooltip={t('errors.pos.noReturnPermission')}
                        >
                            <Button variant="danger" isLoading={returnLoading} onClick={handleSubmitReturn}>
                                {t('pos.issueRefund')}
                            </Button>
                        </PermissionGate>
                    </div>
                }
            >
                <div className="pos-modal-content">
                    <Input
                        label={t('pos.orderNumber')}
                        placeholder={t('pos.orderNumberPlaceholder')}
                        value={returnQuery}
                        onChange={(event) => setReturnQuery(event.target.value)}
                    />
                    <PermissionGate
                        perms={[PERMISSIONS.POS_RETURN_CREATE, PERMISSIONS.POS_RETURNS]}
                        tooltip={t('errors.pos.noReturnPermission')}
                    >
                        <Button variant="secondary" onClick={() => handleLoadReturnOrder()} disabled={returnLoading}>
                            {returnLoading ? t('pos.loading') : t('pos.loadOrder')}
                        </Button>
                    </PermissionGate>
                    {returnError && <div className="pos-inline-error">{returnError}</div>}

                    {returnOrder && (
                        <div className="pos-return">
                            <div className="pos-return__summary">
                                <div>{t('pos.orderSummary', { orderNumber: returnOrder.order_number })}</div>
                                <div>{new Date(returnOrder.created_at).toLocaleString(locale)}</div>
                            </div>
                            <div className="pos-return__lines">
                                {returnOrder.lines.map((line: any) => {
                                    const maxQty = line.quantity - (line.returned_quantity || 0);
                                    return (
                                        <div key={line.id} className="pos-return-line">
                                            <div>
                                                <div className="pos-return-line__name">{line.product_name}</div>
                                                <div className="pos-return-line__meta">
                                                    {t('pos.soldReturned', { sold: line.quantity, returned: line.returned_quantity || 0 })}
                                                </div>
                                            </div>
                                            <Input
                                                type="number"
                                                value={String(returnItems[line.id] || '')}
                                                onChange={(event) => {
                                                    const value = Number(event.target.value);
                                                    setReturnItems(prev => ({
                                                        ...prev,
                                                        [line.id]: Math.min(Math.max(value, 0), maxQty)
                                                    }));
                                                }}
                                                placeholder={t('pos.returnQtyPlaceholder', { max: maxQty })}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <Input
                                label={t('pos.returnReason')}
                                placeholder={t('pos.returnReasonPlaceholder')}
                                value={returnReason}
                                onChange={(event) => setReturnReason(event.target.value)}
                            />
                            <div className="pos-return__total">
                                {t('pos.refundTotal', { total: formatCurrency(returnTotal) })}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </POSLayout >
    );
};

export default POSPage;

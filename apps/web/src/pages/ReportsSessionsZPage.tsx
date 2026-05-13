import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Column, DateRangePicker, PageHeader, Select, Table } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types/inventory';
import { SessionOrderItem, SessionsReportItem } from '../types/reporting';
import { useCurrency } from '../hooks/useCurrency';
import { formatDateTime, formatMoney, normalizeLocale } from '../utils/format';
import '../styles/ReportsDetailPage.css';

type SessionGroup = 'none' | 'branch' | 'cashier' | 'status';

const toRangeIso = (value: string, end: boolean) => {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    if (end) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return date.toISOString();
};

const getInitialRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10)
    };
};

export const ReportsSessionsZPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    const currency = useCurrency();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchId, setBranchId] = useState('');
    const [groupBy, setGroupBy] = useState<SessionGroup>('none');
    const [range, setRange] = useState(getInitialRange);
    const [items, setItems] = useState<SessionsReportItem[]>([]);
    const [selected, setSelected] = useState<SessionsReportItem | null>(null);
    const [orders, setOrders] = useState<SessionOrderItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);
    const [error, setError] = useState('');
    const [ordersError, setOrdersError] = useState('');

    const formatMoneyValue = useCallback(
        (value: number) => formatMoney(value, currency, locale),
        [currency, locale]
    );

    const formatDateTimeValue = useCallback(
        (value: string | null | undefined) => {
            if (!value) return t('common.placeholder');
            return formatDateTime(value, locale, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
        },
        [locale, t]
    );

    const loadBranches = useCallback(async () => {
        try {
            const data = await api<{ items: Branch[] }>('/branches');
            setBranches(data.items || []);
        } catch {
            setBranches([]);
        }
    }, [api]);

    const loadReport = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            if (branchId) params.set('branchId', branchId);
            const data = await api<{ items: SessionsReportItem[] }>(`/reports/sessions-z?${params.toString()}`);
            setItems(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.reports.sessionsLoadFailed'));
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [api, branchId, range, t]);

    const loadOrders = useCallback(async (session: SessionsReportItem) => {
        setIsLoadingOrders(true);
        setOrdersError('');
        try {
            const params = new URLSearchParams();
            params.set('sessionId', session.session_id);
            const data = await api<{ items: SessionOrderItem[] }>(`/reports/sessions-z/orders?${params.toString()}`);
            setOrders(data.items || []);
        } catch (err: any) {
            setOrdersError(err?.message || t('errors.reports.sessionsOrdersLoadFailed'));
            setOrders([]);
        } finally {
            setIsLoadingOrders(false);
        }
    }, [api, t]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    useEffect(() => {
        setSelected(null);
        setOrders([]);
        setOrdersError('');
    }, [branchId, range, groupBy]);

    const totals = useMemo(() => {
        const summary = items.reduce(
            (acc, item) => {
                acc.sessions += 1;
                acc.sales += item.total_sales || 0;
                acc.orders += item.orders_count || 0;
                acc.cash += item.actual_cash ?? item.closing_cash ?? 0;
                return acc;
            },
            { sessions: 0, sales: 0, orders: 0, cash: 0 }
        );
        return {
            ...summary,
            avgSales: summary.sessions ? summary.sales / summary.sessions : 0,
            avgOrders: summary.sessions ? summary.orders / summary.sessions : 0
        };
    }, [items]);

    const groupedItems = useMemo(() => {
        if (groupBy === 'none') {
            return [{ label: t('reports.sessionsZ.groupLabels.all'), items }];
        }
        const map = new Map<string, SessionsReportItem[]>();
        items.forEach((item) => {
            const key = groupBy === 'branch'
                ? item.branch_name || t('common.unassigned')
                : groupBy === 'cashier'
                    ? item.user_name || t('common.unknown')
                    : item.status || t('common.unknown');
            const list = map.get(key) || [];
            list.push(item);
            map.set(key, list);
        });
        return Array.from(map.entries()).map(([label, groupItems]) => ({ label, items: groupItems }));
    }, [groupBy, items, t]);

    const columns: Column<any>[] = useMemo(() => ([
        {
            header: t('reports.sessionsZ.table.session'),
            accessorKey: 'session_id',
            cell: (row: SessionsReportItem) => row.session_id
        },
        {
            header: t('reports.sessionsZ.table.cashier'),
            accessorKey: 'user_name',
            cell: (row: SessionsReportItem) => row.user_name || t('common.unknown')
        },
        {
            header: t('reports.sessionsZ.table.branch'),
            accessorKey: 'branch_name',
            cell: (row: SessionsReportItem) => row.branch_name || t('common.unassigned')
        },
        {
            header: t('reports.sessionsZ.table.start'),
            accessorKey: 'start_time',
            cell: (row: SessionsReportItem) => formatDateTimeValue(row.start_time)
        },
        {
            header: t('reports.sessionsZ.table.end'),
            accessorKey: 'end_time',
            cell: (row: SessionsReportItem) => formatDateTimeValue(row.end_time)
        },
        {
            header: t('reports.sessionsZ.table.orders'),
            accessorKey: 'orders_count',
            cell: (row: SessionsReportItem) => row.orders_count || 0
        },
        {
            header: t('reports.sessionsZ.table.cashSales'),
            accessorKey: 'cash_sales',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.cash_sales || 0)
        },
        {
            header: t('reports.sessionsZ.table.cardSales'),
            accessorKey: 'card_sales',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.card_sales || 0)
        },
        {
            header: t('reports.sessionsZ.table.transferSales'),
            accessorKey: 'transfer_sales',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.transfer_sales || 0)
        },
        {
            header: t('reports.sessionsZ.table.deliveryPending'),
            accessorKey: 'delivery_pending',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.delivery_pending || 0)
        },
        {
            header: t('reports.sessionsZ.table.deliveryCollected'),
            accessorKey: 'delivery_collected',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.delivery_collected || 0)
        },
        {
            header: t('reports.sessionsZ.table.cashRefunds'),
            accessorKey: 'cash_refunds',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.cash_refunds || 0)
        },
        {
            header: t('reports.sessionsZ.table.cashIn'),
            accessorKey: 'cash_in',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.cash_in || 0)
        },
        {
            header: t('reports.sessionsZ.table.cashOut'),
            accessorKey: 'cash_out',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.cash_out || 0)
        },
        {
            header: t('reports.sessionsZ.table.expectedCash'),
            accessorKey: 'expected_cash',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.expected_cash || 0)
        },
        {
            header: t('reports.sessionsZ.table.actualCash'),
            accessorKey: 'actual_cash',
            cell: (row: SessionsReportItem) => row.actual_cash === null || row.actual_cash === undefined ? t('common.placeholder') : formatMoneyValue(row.actual_cash)
        },
        {
            header: t('reports.sessionsZ.table.cashDifference'),
            accessorKey: 'cash_difference',
            cell: (row: SessionsReportItem) => formatMoneyValue(row.cash_difference || 0)
        },
        {
            header: t('reports.sessionsZ.table.status'),
            accessorKey: 'status',
            cell: (row: SessionsReportItem) => row.status
        }
    ]), [formatDateTimeValue, formatMoneyValue, t]);

    const orderColumns: Column<any>[] = useMemo(() => ([
        {
            header: t('reports.sessionsZ.table.order'),
            accessorKey: 'order_number',
            cell: (row: SessionOrderItem) => row.order_number || row.order_id
        },
        {
            header: t('reports.sessionsZ.table.date'),
            accessorKey: 'created_at',
            cell: (row: SessionOrderItem) => formatDateTimeValue(row.created_at)
        },
        {
            header: t('reports.sessionsZ.table.total'),
            accessorKey: 'total_amount',
            cell: (row: SessionOrderItem) => formatMoneyValue(row.total_amount || 0)
        },
        {
            header: t('reports.sessionsZ.table.payment'),
            accessorKey: 'payment_method',
            cell: (row: SessionOrderItem) => row.payment_method || t('common.placeholder')
        },
        {
            header: t('reports.sessionsZ.table.journal'),
            accessorKey: 'journal_entry_id',
            cell: (row: SessionOrderItem) => row.journal_entry_id ? (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/accounting/journals/${row.journal_entry_id}`)}>
                    {t('common.viewEntry')}
                </Button>
            ) : t('common.placeholder')
        }
    ]), [formatDateTimeValue, formatMoneyValue, navigate, t]);

    const handleExport = () => {
        if (items.length === 0) return;
        const header = [
            t('reports.sessionsZ.table.session'),
            t('reports.sessionsZ.table.cashier'),
            t('reports.sessionsZ.table.branch'),
            t('reports.sessionsZ.table.start'),
            t('reports.sessionsZ.table.end'),
            t('reports.sessionsZ.table.orders'),
            t('reports.sessionsZ.table.cashSales'),
            t('reports.sessionsZ.table.cardSales'),
            t('reports.sessionsZ.table.transferSales'),
            t('reports.sessionsZ.table.deliveryPending'),
            t('reports.sessionsZ.table.deliveryCollected'),
            t('reports.sessionsZ.table.cashRefunds'),
            t('reports.sessionsZ.table.cashIn'),
            t('reports.sessionsZ.table.cashOut'),
            t('reports.sessionsZ.table.openingCash'),
            t('reports.sessionsZ.table.expectedCash'),
            t('reports.sessionsZ.table.actualCash'),
            t('reports.sessionsZ.table.cashDifference'),
            t('reports.sessionsZ.table.status')
        ];
        const rows = items.map((row) => [
            row.session_id,
            row.user_name || '',
            row.branch_name || '',
            formatDateTimeValue(row.start_time),
            formatDateTimeValue(row.end_time),
            String(row.orders_count || 0),
            formatMoneyValue(row.cash_sales || 0),
            formatMoneyValue(row.card_sales || 0),
            formatMoneyValue(row.transfer_sales || 0),
            formatMoneyValue(row.delivery_pending || 0),
            formatMoneyValue(row.delivery_collected || 0),
            formatMoneyValue(row.cash_refunds || 0),
            formatMoneyValue(row.cash_in || 0),
            formatMoneyValue(row.cash_out || 0),
            formatMoneyValue(row.opening_cash || 0),
            formatMoneyValue(row.expected_cash || 0),
            row.actual_cash === null || row.actual_cash === undefined ? '' : formatMoneyValue(row.actual_cash),
            formatMoneyValue(row.cash_difference || 0),
            row.status
        ]);
        const csv = [header, ...rows]
            .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sessions-z-${range.startDate}-${range.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="report-page">
            <PageHeader
                title={t('reports.sessionsZ.title')}
                subtitle={t('reports.sessionsZ.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <div className="report-page__actions">
                        <Button variant="secondary" onClick={handleExport} disabled={items.length === 0}>
                            {t('common.exportCsv')}
                        </Button>
                        <Button variant="ghost" onClick={() => window.print()} disabled={items.length === 0}>
                            {t('common.print')}
                        </Button>
                    </div>
                )}
            />

            {error && <div className="report-page__error">{error}</div>}
            {isLoading && <div className="report-page__loading">{t('reports.sessionsZ.loading')}</div>}

            <div className="report-page__filters">
                <Select
                    label={t('common.groupBy')}
                    value={groupBy}
                    onChange={(event) => setGroupBy(event.target.value as SessionGroup)}
                >
                    <option value="none">{t('reports.sessionsZ.groupBy.none')}</option>
                    <option value="branch">{t('reports.sessionsZ.groupBy.branch')}</option>
                    <option value="cashier">{t('reports.sessionsZ.groupBy.cashier')}</option>
                    <option value="status">{t('reports.sessionsZ.groupBy.status')}</option>
                </Select>
                <Select
                    label={t('common.branch')}
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                >
                    <option value="">{t('common.allBranches')}</option>
                    {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                </Select>
                <div className="report-page__range">
                    <DateRangePicker
                        value={range}
                        onChange={setRange}
                        startLabel={t('common.startDate')}
                        endLabel={t('common.endDate')}
                        separatorLabel={t('common.to')}
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.sessionsZ.summary.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="report-page__summary-grid">
                        <div>
                            <div className="report-page__summary-label">{t('reports.sessionsZ.summary.sessionsLabel')}</div>
                            <div className="report-page__summary-value">{totals.sessions}</div>
                            <div className="report-page__summary-hint">{t('reports.sessionsZ.summary.sessionsHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.sessionsZ.summary.salesLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.sales)}</div>
                            <div className="report-page__summary-hint">{t('reports.sessionsZ.summary.salesHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.sessionsZ.summary.avgSalesLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.avgSales)}</div>
                            <div className="report-page__summary-hint">{t('reports.sessionsZ.summary.avgSalesHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.sessionsZ.summary.ordersLabel')}</div>
                            <div className="report-page__summary-value">{totals.orders}</div>
                            <div className="report-page__summary-hint">{t('reports.sessionsZ.summary.ordersHint', { value: totals.avgOrders.toFixed(1) })}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.sessionsZ.summary.closingLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.cash)}</div>
                            <div className="report-page__summary-hint">{t('reports.sessionsZ.summary.closingHint')}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="report-page__table-header">
                    <CardTitle>{t('reports.sessionsZ.results.title')}</CardTitle>
                    <span className="report-page__table-meta">{t('reports.sessionsZ.results.count', { count: items.length })}</span>
                </CardHeader>
                <CardContent>
                    {groupedItems.map((group) => (
                        <div key={group.label} className="report-page__section">
                            {groupBy !== 'none' && <div className="report-page__transactions-title">{group.label}</div>}
                            <Table
                                data={group.items.map(item => ({ ...item, id: item.session_id }))}
                                columns={columns}
                                isLoading={isLoading}
                                onRowClick={(row) => {
                                    setSelected(row);
                                    loadOrders(row);
                                }}
                            />
                        </div>
                    ))}
                    {!isLoading && !error && items.length === 0 && (
                        <div className="report-page__empty">
                            <div className="report-page__empty-title">{t('reports.sessionsZ.emptyTitle')}</div>
                            <div>{t('reports.sessionsZ.emptyDescription')}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.sessionsZ.orders.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {!selected && (
                        <div className="report-page__empty">
                            <div className="report-page__empty-title">{t('reports.sessionsZ.orders.emptyTitle')}</div>
                            <div>{t('reports.sessionsZ.orders.emptyDescription')}</div>
                        </div>
                    )}
                    {selected && (
                        <div className="report-page__section">
                            <div>
                                <div className="report-page__transactions-title">
                                    {t('reports.sessionsZ.orders.sessionTitle', { id: selected.session_id })}
                                </div>
                                <div className="report-page__transactions-subtitle">
                                    {t('reports.sessionsZ.orders.subtitle')}
                                </div>
                            </div>
                            {ordersError && <div className="report-page__error">{ordersError}</div>}
                            {isLoadingOrders && <div className="report-page__loading">{t('reports.sessionsZ.orders.loading')}</div>}
                            <Table
                                data={orders.map(order => ({ ...order, id: (order.order_id || undefined) as string | undefined }))}
                                columns={orderColumns}
                                isLoading={isLoadingOrders}
                            />
                            {!isLoadingOrders && !ordersError && orders.length === 0 && (
                                <div className="report-page__empty">{t('reports.sessionsZ.orders.empty')}</div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ReportsSessionsZPage;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Column, DateRangePicker, Input, PageHeader, Select, Table } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types/inventory';
import { SalesReportResponse, SalesReportItem, SalesTransactionItem } from '../types/reporting';
import { useCurrency } from '../hooks/useCurrency';
import { formatDateTime, formatMoney, normalizeLocale } from '../utils/format';
import '../styles/ReportsDetailPage.css';

type SalesGroup = 'item' | 'category' | 'payment';

const toRangeIso = (dateStr: string, timeStr: string) => {
    if (!dateStr) return new Date().toISOString();
    // Assuming dateStr is YYYY-MM-DD and timeStr is HH:mm
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = (timeStr || '00:00').split(':').map(Number);
    const date = new Date(year, month - 1, day, hour, minute, 0, 0);
    return date.toISOString();
};

const getInitialRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10),
        startTime: '00:00',
        endTime: '23:59'
    };
};

export const ReportsSalesPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    const currency = useCurrency();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchId, setBranchId] = useState('');
    const [groupBy, setGroupBy] = useState<SalesGroup>('item');
    const [range, setRange] = useState(getInitialRange);
    const [items, setItems] = useState<SalesReportItem[]>([]);
    const [selected, setSelected] = useState<SalesReportItem | null>(null);
    const [transactions, setTransactions] = useState<SalesTransactionItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [error, setError] = useState('');
    const [transactionError, setTransactionError] = useState('');

    const formatMoneyValue = useCallback(
        (value: number) => formatMoney(value, currency, locale),
        [currency, locale]
    );

    const formatDateTimeValue = useCallback(
        (value: string) => formatDateTime(value, locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }),
        [locale]
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
            params.set('startDate', toRangeIso(range.startDate, range.startTime));
            params.set('endDate', toRangeIso(range.endDate, range.endTime));
            params.set('groupBy', groupBy);
            if (branchId) params.set('branchId', branchId);
            const data = await api<SalesReportResponse>(`/reports/sales?${params.toString()}`);
            setItems(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.reports.salesLoadFailed'));
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [api, branchId, groupBy, range, t]);

    const loadTransactions = useCallback(async (item: SalesReportItem) => {
        setIsLoadingTransactions(true);
        setTransactionError('');
        try {
            const params = new URLSearchParams();
            params.set('startDate', toRangeIso(range.startDate, range.startTime));
            params.set('endDate', toRangeIso(range.endDate, range.endTime));
            params.set('groupBy', groupBy);
            params.set('key', String(item.key));
            if (branchId) params.set('branchId', branchId);
            const data = await api<{ items: SalesTransactionItem[] }>(`/reports/sales/transactions?${params.toString()}`);
            setTransactions(data.items || []);
        } catch (err: any) {
            setTransactionError(err?.message || t('errors.reports.transactionsLoadFailed'));
            setTransactions([]);
        } finally {
            setIsLoadingTransactions(false);
        }
    }, [api, branchId, groupBy, range, t]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    useEffect(() => {
        setSelected(null);
        setTransactions([]);
        setTransactionError('');
    }, [branchId, groupBy, range]);

    const totals = useMemo(() => {
        const summary = items.reduce(
            (acc, item) => {
                acc.revenue += item.revenue || 0;
                acc.cost += item.cost || 0;
                acc.quantity += item.quantity || 0;
                acc.orders += item.orders || 0;
                return acc;
            },
            { revenue: 0, cost: 0, quantity: 0, orders: 0 }
        );
        const margin = summary.revenue - summary.cost;
        return { ...summary, margin, marginRate: summary.revenue ? (margin / summary.revenue) * 100 : 0 };
    }, [items]);

    const columns: Column<any>[] = useMemo(() => {
        if (groupBy === 'payment') {
            return [
                {
                    header: t('reports.sales.table.paymentMethod'),
                    accessorKey: 'label',
                    cell: (row: SalesReportItem) => row.label
                },
                {
                    header: t('reports.sales.table.orders'),
                    accessorKey: 'orders',
                    cell: (row: SalesReportItem) => row.orders ?? 0
                },
                {
                    header: t('reports.sales.table.revenue'),
                    accessorKey: 'revenue',
                    cell: (row: SalesReportItem) => formatMoneyValue(row.revenue || 0)
                }
            ];
        }
        return [
            {
                header: groupBy === 'category' ? t('reports.sales.table.category') : t('reports.sales.table.item'),
                accessorKey: 'label',
                cell: (row: SalesReportItem) => row.label
            },
            {
                header: t('reports.sales.table.quantity'),
                accessorKey: 'quantity',
                cell: (row: SalesReportItem) => row.quantity ?? 0
            },
            {
                header: t('reports.sales.table.revenue'),
                accessorKey: 'revenue',
                cell: (row: SalesReportItem) => formatMoneyValue(row.revenue || 0)
            },
            {
                header: t('reports.sales.table.cost'),
                accessorKey: 'cost',
                cell: (row: SalesReportItem) => formatMoneyValue(row.cost || 0)
            },
            {
                header: t('reports.sales.table.margin'),
                accessorKey: 'margin',
                cell: (row: SalesReportItem) => formatMoneyValue((row.revenue || 0) - (row.cost || 0))
            }
        ];
    }, [formatMoneyValue, groupBy, t]);

    const transactionColumns: Column<any>[] = useMemo(() => {
        if (groupBy === 'payment') {
            return [
                {
                    header: t('reports.sales.table.order'),
                    accessorKey: 'order_number',
                    cell: (row: SalesTransactionItem) => row.order_number || row.order_id
                },
                {
                    header: t('reports.sales.table.date'),
                    accessorKey: 'created_at',
                    cell: (row: SalesTransactionItem) => formatDateTimeValue(row.created_at)
                },
                {
                    header: t('reports.sales.table.payment'),
                    accessorKey: 'payment_method',
                    cell: (row: SalesTransactionItem) => row.payment_method || t('common.paymentMethods.cash')
                },
                {
                    header: t('reports.sales.table.total'),
                    accessorKey: 'total_amount',
                    cell: (row: SalesTransactionItem) => formatMoneyValue(row.total_amount || 0)
                },
                {
                    header: t('reports.sales.table.journal'),
                    accessorKey: 'journal_entry_id',
                    cell: (row: SalesTransactionItem) => (
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={!row.journal_entry_id}
                            onClick={() => row.journal_entry_id && navigate(`/journals/${row.journal_entry_id}`)}
                        >
                            {t('common.viewEntry')}
                        </Button>
                    )
                }
            ];
        }

        return [
            {
                header: t('reports.sales.table.order'),
                accessorKey: 'order_number',
                cell: (row: SalesTransactionItem) => row.order_number || row.order_id
            },
            {
                header: t('reports.sales.table.date'),
                accessorKey: 'created_at',
                cell: (row: SalesTransactionItem) => formatDateTimeValue(row.created_at)
            },
            {
                header: t('reports.sales.table.product'),
                accessorKey: 'product_name',
                cell: (row: SalesTransactionItem) => row.product_name || t('common.placeholder')
            },
            {
                header: t('reports.sales.table.category'),
                accessorKey: 'category_name',
                cell: (row: SalesTransactionItem) => row.category_name || t('common.uncategorized')
            },
            {
                header: t('reports.sales.table.qty'),
                accessorKey: 'quantity',
                cell: (row: SalesTransactionItem) => row.quantity ?? 0
            },
            {
                header: t('reports.sales.table.total'),
                accessorKey: 'total_price',
                cell: (row: SalesTransactionItem) => formatMoneyValue(row.total_price || 0)
            },
            {
                header: t('reports.sales.table.journal'),
                accessorKey: 'journal_entry_id',
                cell: (row: SalesTransactionItem) => (
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={!row.journal_entry_id}
                        onClick={() => row.journal_entry_id && navigate(`/journals/${row.journal_entry_id}`)}
                    >
                        {t('common.viewEntry')}
                    </Button>
                )
            }
        ];
    }, [formatDateTimeValue, formatMoneyValue, groupBy, navigate, t]);

    const handleExport = () => {
        if (items.length === 0) return;
        const header = groupBy === 'payment'
            ? [t('reports.sales.table.paymentMethod'), t('reports.sales.table.orders'), t('reports.sales.table.revenue')]
            : [t('reports.sales.table.label'), t('reports.sales.table.quantity'), t('reports.sales.table.revenue'), t('reports.sales.table.cost'), t('reports.sales.table.margin')];
        const rows = items.map((row) => {
            if (groupBy === 'payment') {
                return [
                    row.label,
                    String(row.orders || 0),
                    formatMoneyValue(row.revenue || 0)
                ];
            }
            return [
                row.label,
                String(row.quantity || 0),
                formatMoneyValue(row.revenue || 0),
                formatMoneyValue(row.cost || 0),
                formatMoneyValue((row.revenue || 0) - (row.cost || 0))
            ];
        });
        const csv = [header, ...rows]
            .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `sales-report-${range.startDate}-${range.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="report-page">
            <div className="no-print">
                <PageHeader
                    title={t('reports.sales.title')}
                    subtitle={t('reports.sales.subtitle')}
                    backButton={<BackButton />}
                    actions={(
                        <div className="report-page__actions">
                            <Button variant="secondary" onClick={handleExport} disabled={items.length === 0}>
                                {t('common.exportCsv')}
                            </Button>
                            <Button variant="ghost" onClick={() => window.print()} disabled={items.length === 0}>
                                🖨️ {t('common.print')}
                            </Button>
                        </div>
                    )}
                />
            </div>

            <div className="print-only report-print-header">
                <h1>{t('reports.sales.title')}</h1>
                <div className="report-print-meta">
                    <span>{t('common.branch')}: {branchId ? branches.find(b => String(b.id) === String(branchId))?.name : t('common.allBranches')}</span>
                    <span>{t('common.date')}: {range.startDate} {range.startTime} {t('common.to')} {range.endDate} {range.endTime}</span>
                    <span>{t('reports.sales.summary.revenueLabel')}: {formatMoneyValue(totals.revenue)}</span>
                </div>
            </div>

            <div className="no-print">
                {error && <div className="report-page__error">{error}</div>}
                {isLoading && <div className="report-page__loading">{t('reports.sales.loading')}</div>}

                <div className="report-page__filters">
                    <Select
                        label={t('common.groupBy')}
                        value={groupBy}
                        onChange={(event) => setGroupBy(event.target.value as SalesGroup)}
                    >
                        <option value="item">{t('reports.sales.groupBy.item')}</option>
                        <option value="category">{t('reports.sales.groupBy.category')}</option>
                        <option value="payment">{t('reports.sales.groupBy.payment')}</option>
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
                            onChange={(newRange) => setRange(prev => ({ ...prev, ...newRange }))}
                            startLabel={t('common.startDate')}
                            endLabel={t('common.endDate')}
                            separatorLabel={t('common.to')}
                        />
                    </div>

                    <div className="report-page__time-group">
                        <Input
                            type="time"
                            label={t('common.startTime', 'Start Time')}
                            value={range.startTime}
                            onChange={(e) => setRange(prev => ({ ...prev, startTime: e.target.value }))}
                        />
                        <Input
                            type="time"
                            label={t('common.endTime', 'End Time')}
                            value={range.endTime}
                            onChange={(e) => setRange(prev => ({ ...prev, endTime: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.sales.summary.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="report-page__summary-grid">
                        <div>
                            <div className="report-page__summary-label">{t('reports.sales.summary.revenueLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.revenue)}</div>
                            <div className="report-page__summary-hint">{t('reports.sales.summary.revenueHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">
                                {groupBy === 'payment' ? t('reports.sales.summary.ordersLabel') : t('reports.sales.summary.rowsLabel')}
                            </div>
                            <div className="report-page__summary-value">
                                {groupBy === 'payment' ? totals.orders : items.length}
                            </div>
                            <div className="report-page__summary-hint">
                                {groupBy === 'payment' ? t('reports.sales.summary.ordersHint') : t('reports.sales.summary.rowsHint')}
                            </div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.sales.summary.quantityLabel')}</div>
                            <div className="report-page__summary-value">{totals.quantity}</div>
                            <div className="report-page__summary-hint">{t('reports.sales.summary.quantityHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.sales.summary.marginLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.margin)}</div>
                            <div className="report-page__summary-hint">
                                {t('reports.sales.summary.marginHint', { value: totals.marginRate.toFixed(1) })}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="report-page__table-header">
                    <CardTitle>{t('reports.sales.results.title')}</CardTitle>
                    <span className="report-page__table-meta">{t('common.rowsCount', { count: items.length })}</span>
                </CardHeader>
                <CardContent>
                    <Table
                        data={items.map(item => ({ ...item, id: item.key }))}
                        columns={columns}
                        isLoading={isLoading}
                        onRowClick={(row) => {
                            setSelected(row);
                            loadTransactions(row);
                        }}
                    />
                    {!isLoading && !error && items.length === 0 && (
                        <div className="report-page__empty">
                            <div className="report-page__empty-title">{t('reports.sales.emptyTitle')}</div>
                            <div>{t('reports.sales.emptyDescription')}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="no-print">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('reports.sales.transactions.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!selected && (
                            <div className="report-page__empty">
                                <div className="report-page__empty-title">{t('reports.sales.transactions.emptyTitle')}</div>
                                <div>{t('reports.sales.transactions.emptyDescription')}</div>
                            </div>
                        )}
                        {selected && (
                            <div className="report-page__section">
                                <div>
                                    <div className="report-page__transactions-title">{selected.label}</div>
                                    <div className="report-page__transactions-subtitle">
                                        {t('reports.sales.transactions.subtitle')}
                                    </div>
                                </div>
                                {transactionError && <div className="report-page__error">{transactionError}</div>}
                                {isLoadingTransactions && <div className="report-page__loading">{t('reports.sales.transactions.loading')}</div>}
                                <Table
                                    data={transactions.map(t => ({ ...t, id: (t.order_id || undefined) as string | undefined }))}
                                    columns={transactionColumns}
                                    isLoading={isLoadingTransactions}
                                />
                                {!isLoadingTransactions && !transactionError && transactions.length === 0 && (
                                    <div className="report-page__empty">{t('reports.sales.transactions.empty')}</div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div >
    );
};

export default ReportsSalesPage;

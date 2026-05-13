import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Column, DateRangePicker, PageHeader, Select, Table } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types/inventory';
import { SalesReportItem, SalesReportResponse, SalesTransactionItem } from '../types/reporting';
import { useCurrency } from '../hooks/useCurrency';
import { formatDateTime, formatMoney, normalizeLocale } from '../utils/format';
import '../styles/ReportsDetailPage.css';

type MarginGroup = 'item' | 'category';

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

export const ReportsMarginsPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    const currency = useCurrency();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchId, setBranchId] = useState('');
    const [groupBy, setGroupBy] = useState<MarginGroup>('item');
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
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            params.set('groupBy', groupBy);
            if (branchId) params.set('branchId', branchId);
            const data = await api<SalesReportResponse>(`/reports/margins?${params.toString()}`);
            setItems(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.reports.marginsLoadFailed'));
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
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            params.set('groupBy', groupBy);
            params.set('key', String(item.key));
            if (branchId) params.set('branchId', branchId);
            const data = await api<{ items: SalesTransactionItem[] }>(`/reports/margins/transactions?${params.toString()}`);
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
                return acc;
            },
            { revenue: 0, cost: 0, quantity: 0 }
        );
        const margin = summary.revenue - summary.cost;
        return { ...summary, margin, marginRate: summary.revenue ? (margin / summary.revenue) * 100 : 0 };
    }, [items]);

    const columns: Column<any>[] = useMemo(() => ([
        {
            header: groupBy === 'category' ? t('reports.margins.table.category') : t('reports.margins.table.item'),
            accessorKey: 'label',
            cell: (row: SalesReportItem) => row.label
        },
        {
            header: t('reports.margins.table.quantity'),
            accessorKey: 'quantity',
            cell: (row: SalesReportItem) => row.quantity ?? 0
        },
        {
            header: t('reports.margins.table.revenue'),
            accessorKey: 'revenue',
            cell: (row: SalesReportItem) => formatMoneyValue(row.revenue || 0)
        },
        {
            header: t('reports.margins.table.cogs'),
            accessorKey: 'cost',
            cell: (row: SalesReportItem) => formatMoneyValue(row.cost || 0)
        },
        {
            header: t('reports.margins.table.margin'),
            accessorKey: 'margin',
            cell: (row: SalesReportItem) => formatMoneyValue((row.revenue || 0) - (row.cost || 0))
        }
    ]), [formatMoneyValue, groupBy, t]);

    const transactionColumns: Column<any>[] = useMemo(() => ([
        {
            header: t('reports.margins.table.order'),
            accessorKey: 'order_number',
            cell: (row: SalesTransactionItem) => row.order_number || row.order_id
        },
        {
            header: t('reports.margins.table.date'),
            accessorKey: 'created_at',
            cell: (row: SalesTransactionItem) => formatDateTimeValue(row.created_at)
        },
        {
            header: t('reports.margins.table.product'),
            accessorKey: 'product_name',
            cell: (row: SalesTransactionItem) => row.product_name || t('common.placeholder')
        },
        {
            header: t('reports.margins.table.qty'),
            accessorKey: 'quantity',
            cell: (row: SalesTransactionItem) => row.quantity ?? 0
        },
        {
            header: t('reports.margins.table.total'),
            accessorKey: 'total_price',
            cell: (row: SalesTransactionItem) => formatMoneyValue(row.total_price || 0)
        },
        {
            header: t('reports.margins.table.cogs'),
            accessorKey: 'cost_at_time',
            cell: (row: SalesTransactionItem) => formatMoneyValue((row.cost_at_time || 0) * (row.quantity || 0))
        },
        {
            header: t('reports.margins.table.journal'),
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
    ]), [formatDateTimeValue, formatMoneyValue, navigate, t]);

    const handleExport = () => {
        if (items.length === 0) return;
        const header = [
            t('reports.margins.table.label'),
            t('reports.margins.table.quantity'),
            t('reports.margins.table.revenue'),
            t('reports.margins.table.cogs'),
            t('reports.margins.table.margin')
        ];
        const rows = items.map((row) => [
            row.label,
            String(row.quantity || 0),
            formatMoneyValue(row.revenue || 0),
            formatMoneyValue(row.cost || 0),
            formatMoneyValue((row.revenue || 0) - (row.cost || 0))
        ]);
        const csv = [header, ...rows]
            .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `margin-report-${range.startDate}-${range.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="report-page">
            <PageHeader
                title={t('reports.margins.title')}
                subtitle={t('reports.margins.subtitle')}
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
            {isLoading && <div className="report-page__loading">{t('reports.margins.loading')}</div>}

            <div className="report-page__filters">
                <Select
                    label={t('common.groupBy')}
                    value={groupBy}
                    onChange={(event) => setGroupBy(event.target.value as MarginGroup)}
                >
                    <option value="item">{t('reports.margins.groupBy.item')}</option>
                    <option value="category">{t('reports.margins.groupBy.category')}</option>
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
                    <CardTitle>{t('reports.margins.summary.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="report-page__summary-grid">
                        <div>
                            <div className="report-page__summary-label">{t('reports.margins.summary.revenueLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.revenue)}</div>
                            <div className="report-page__summary-hint">{t('reports.margins.summary.revenueHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.margins.summary.cogsLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.cost)}</div>
                            <div className="report-page__summary-hint">{t('reports.margins.summary.cogsHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.margins.summary.marginLabel')}</div>
                            <div className="report-page__summary-value">{formatMoneyValue(totals.margin)}</div>
                            <div className="report-page__summary-hint">{t('reports.margins.summary.marginHint', { value: totals.marginRate.toFixed(1) })}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.margins.summary.unitsLabel')}</div>
                            <div className="report-page__summary-value">{totals.quantity}</div>
                            <div className="report-page__summary-hint">{t('reports.margins.summary.unitsHint')}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="report-page__table-header">
                    <CardTitle>{t('reports.margins.results.title')}</CardTitle>
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
                            <div className="report-page__empty-title">{t('reports.margins.emptyTitle')}</div>
                            <div>{t('reports.margins.emptyDescription')}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.margins.transactions.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {!selected && (
                        <div className="report-page__empty">
                            <div className="report-page__empty-title">{t('reports.margins.transactions.emptyTitle')}</div>
                            <div>{t('reports.margins.transactions.emptyDescription')}</div>
                        </div>
                    )}
                    {selected && (
                        <div className="report-page__section">
                            <div>
                                <div className="report-page__transactions-title">{selected.label}</div>
                                <div className="report-page__transactions-subtitle">
                                    {t('reports.margins.transactions.subtitle')}
                                </div>
                            </div>
                            {transactionError && <div className="report-page__error">{transactionError}</div>}
                            {isLoadingTransactions && <div className="report-page__loading">{t('reports.margins.transactions.loading')}</div>}
                            <Table
                                data={transactions.map(t => ({ ...t, id: (t.order_id || undefined) as string | undefined }))}
                                columns={transactionColumns}
                                isLoading={isLoadingTransactions}
                            />
                            {!isLoadingTransactions && !transactionError && transactions.length === 0 && (
                                <div className="report-page__empty">{t('reports.margins.transactions.empty')}</div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ReportsMarginsPage;

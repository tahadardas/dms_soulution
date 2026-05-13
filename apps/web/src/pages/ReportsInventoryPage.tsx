import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Column, DateRangePicker, PageHeader, Select, Table } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types/inventory';
import { InventoryMovementDetail, InventoryReportItem, InventoryReportResponse } from '../types/reporting';
import { formatDateTime, formatNumber, normalizeLocale } from '../utils/format';
import '../styles/ReportsDetailPage.css';

type InventoryGroup = 'detail' | 'product' | 'type';

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

const isMovementDetail = (row: InventoryReportItem | InventoryMovementDetail | { key: string; label: string; net: number }): row is InventoryMovementDetail => {
    return (row as InventoryMovementDetail).product_id !== undefined;
};

export const ReportsInventoryPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [branchId, setBranchId] = useState('');
    const [groupBy, setGroupBy] = useState<InventoryGroup>('detail');
    const [range, setRange] = useState(getInitialRange);
    const [items, setItems] = useState<InventoryReportResponse['items']>([]);
    const [selected, setSelected] = useState<InventoryReportItem | InventoryMovementDetail | null>(null);
    const [transactions, setTransactions] = useState<InventoryMovementDetail[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
    const [error, setError] = useState('');
    const [transactionError, setTransactionError] = useState('');

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

    const formatNumberValue = useCallback(
        (value: number) => formatNumber(value, locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
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
            const data = await api<InventoryReportResponse>(`/reports/inventory?${params.toString()}`);
            setItems(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.reports.inventoryLoadFailed'));
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }, [api, branchId, groupBy, range, t]);

    const loadTransactions = useCallback(async (item: InventoryReportItem) => {
        setIsLoadingTransactions(true);
        setTransactionError('');
        try {
            const params = new URLSearchParams();
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            params.set('groupBy', groupBy);
            params.set('key', String(item.key));
            if (branchId) params.set('branchId', branchId);
            const data = await api<{ items: InventoryMovementDetail[] }>(`/reports/inventory/transactions?${params.toString()}`);
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
        let qtyIn = 0;
        let qtyOut = 0;
        let net = 0;
        if (groupBy === 'detail') {
            items.forEach((row) => {
                if (!isMovementDetail(row)) return;
                if (row.quantity >= 0) qtyIn += row.quantity;
                if (row.quantity < 0) qtyOut += Math.abs(row.quantity);
                net += row.quantity;
            });
        } else {
            items.forEach((row) => {
                if (isMovementDetail(row)) return;
                qtyIn += (row as InventoryReportItem).qty_in || 0;
                qtyOut += (row as InventoryReportItem).qty_out || 0;
                net += (row as InventoryReportItem).net || 0;
            });
        }
        return { qtyIn, qtyOut, net };
    }, [groupBy, items]);

    const columns: Column<any>[] = useMemo(() => {
        if (groupBy === 'detail') {
            return [
                {
                    header: t('reports.inventory.table.date'),
                    accessorKey: 'date',
                    cell: (row: InventoryMovementDetail) => formatDateTimeValue(row.date)
                },
                {
                    header: t('reports.inventory.table.product'),
                    accessorKey: 'product_name',
                    cell: (row: InventoryMovementDetail) => row.product_name || t('common.placeholder')
                },
                {
                    header: t('reports.inventory.table.type'),
                    accessorKey: 'type',
                    cell: (row: InventoryMovementDetail) => row.type
                },
                {
                    header: t('reports.inventory.table.quantity'),
                    accessorKey: 'quantity',
                    cell: (row: InventoryMovementDetail) => formatNumberValue(row.quantity)
                },
                {
                    header: t('reports.inventory.table.branch'),
                    accessorKey: 'branch_name',
                    cell: (row: InventoryMovementDetail) => row.branch_name || t('common.placeholder')
                },
                {
                    header: t('reports.inventory.table.journal'),
                    accessorKey: 'journal_entry_id',
                    cell: (row: InventoryMovementDetail) => (
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

        if (groupBy === 'type') {
            return [
                {
                    header: t('reports.inventory.table.movementType'),
                    accessorKey: 'label',
                    cell: (row: InventoryReportItem) => row.label
                },
                {
                    header: t('reports.inventory.table.netQty'),
                    accessorKey: 'net',
                    cell: (row: InventoryReportItem) => formatNumberValue(row.net || 0)
                }
            ];

        }
        const reportColumns: Column<InventoryReportItem>[] = [
            {
                header: t('reports.inventory.table.product'),
                accessorKey: 'label',
                cell: (row: InventoryReportItem) => row.label
            },
            {
                header: t('reports.inventory.table.qtyIn'),
                accessorKey: 'qty_in',
                cell: (row: InventoryReportItem) => formatNumberValue(row.qty_in || 0)
            },
            {
                header: t('reports.inventory.table.qtyOut'),
                accessorKey: 'qty_out',
                cell: (row: InventoryReportItem) => formatNumberValue(row.qty_out || 0)
            },
            {
                header: t('reports.inventory.table.net'),
                accessorKey: 'net',
                cell: (row: InventoryReportItem) => formatNumberValue(row.net || 0)
            }
        ];
        return reportColumns;
    }, [formatDateTimeValue, formatNumberValue, groupBy, navigate, t]);

    const transactionColumns: Column<any>[] = useMemo(() => ([
        {
            header: t('reports.inventory.table.date'),
            accessorKey: 'date',
            cell: (row: InventoryMovementDetail) => formatDateTimeValue(row.date)
        },
        {
            header: t('reports.inventory.table.product'),
            accessorKey: 'product_name',
            cell: (row: InventoryMovementDetail) => row.product_name || t('common.placeholder')
        },
        {
            header: t('reports.inventory.table.type'),
            accessorKey: 'type',
            cell: (row: InventoryMovementDetail) => row.type
        },
        {
            header: t('reports.inventory.table.quantity'),
            accessorKey: 'quantity',
            cell: (row: InventoryMovementDetail) => formatNumberValue(row.quantity)
        },
        {
            header: t('reports.inventory.table.branch'),
            accessorKey: 'branch_name',
            cell: (row: InventoryMovementDetail) => row.branch_name || t('common.placeholder')
        },
        {
            header: t('reports.inventory.table.journal'),
            accessorKey: 'journal_entry_id',
            cell: (row: InventoryMovementDetail) => (
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
    ]), [formatDateTimeValue, formatNumberValue, navigate, t]);

    const handleExport = () => {
        if (items.length === 0) return;
        const header = groupBy === 'detail'
            ? [t('reports.inventory.table.date'), t('reports.inventory.table.product'), t('reports.inventory.table.type'), t('reports.inventory.table.quantity'), t('reports.inventory.table.branch')]
            : groupBy === 'type'
                ? [t('reports.inventory.table.movementType'), t('reports.inventory.table.netQty')]
                : [t('reports.inventory.table.product'), t('reports.inventory.table.qtyIn'), t('reports.inventory.table.qtyOut'), t('reports.inventory.table.net')];
        const rows = items.map((row) => {
            if (groupBy === 'detail' && isMovementDetail(row)) {
                return [
                    formatDateTimeValue(row.date),
                    row.product_name || '',
                    row.type,
                    formatNumberValue(row.quantity),
                    row.branch_name || ''
                ];
            }
            if (groupBy === 'type') {
                const item = row as InventoryReportItem;
                return [item.label, formatNumberValue(item.net || 0)];
            }
            const item = row as InventoryReportItem;
            return [
                item.label,
                formatNumberValue(item.qty_in || 0),
                formatNumberValue(item.qty_out || 0),
                formatNumberValue(item.net || 0)
            ];
        });
        const csv = [header, ...rows]
            .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `inventory-report-${range.startDate}-${range.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="report-page">
            <PageHeader
                title={t('reports.inventory.title')}
                subtitle={t('reports.inventory.subtitle')}
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
            {isLoading && <div className="report-page__loading">{t('reports.inventory.loading')}</div>}

            <div className="report-page__filters">
                <Select
                    label={t('common.groupBy')}
                    value={groupBy}
                    onChange={(event) => setGroupBy(event.target.value as InventoryGroup)}
                >
                    <option value="detail">{t('reports.inventory.groupBy.detail')}</option>
                    <option value="product">{t('reports.inventory.groupBy.product')}</option>
                    <option value="type">{t('reports.inventory.groupBy.type')}</option>
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
                    <CardTitle>{t('reports.inventory.summary.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="report-page__summary-grid">
                        <div>
                            <div className="report-page__summary-label">{t('reports.inventory.summary.qtyInLabel')}</div>
                            <div className="report-page__summary-value">{formatNumberValue(totals.qtyIn)}</div>
                            <div className="report-page__summary-hint">{t('reports.inventory.summary.qtyInHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.inventory.summary.qtyOutLabel')}</div>
                            <div className="report-page__summary-value">{formatNumberValue(totals.qtyOut)}</div>
                            <div className="report-page__summary-hint">{t('reports.inventory.summary.qtyOutHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.inventory.summary.netLabel')}</div>
                            <div className="report-page__summary-value">{formatNumberValue(totals.net)}</div>
                            <div className="report-page__summary-hint">{t('reports.inventory.summary.netHint')}</div>
                        </div>
                        <div>
                            <div className="report-page__summary-label">{t('reports.inventory.summary.entriesLabel')}</div>
                            <div className="report-page__summary-value">{items.length}</div>
                            <div className="report-page__summary-hint">{t('reports.inventory.summary.entriesHint')}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="report-page__table-header">
                    <CardTitle>{t('reports.inventory.results.title')}</CardTitle>
                    <span className="report-page__table-meta">{t('common.rowsCount', { count: items.length })}</span>
                </CardHeader>
                <CardContent>
                    <Table
                        data={items as any}
                        columns={columns as any}
                        isLoading={isLoading}
                        onRowClick={(row: any) => {
                            if (groupBy === 'detail') {
                                setSelected(row);
                                setTransactions([]);
                            } else {
                                const item = row as InventoryReportItem;
                                setSelected(item);
                                loadTransactions(item);
                            }
                        }}
                    />
                    {!isLoading && !error && items.length === 0 && (
                        <div className="report-page__empty">
                            <div className="report-page__empty-title">{t('reports.inventory.emptyTitle')}</div>
                            <div>{t('reports.inventory.emptyDescription')}</div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.inventory.details.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {!selected && (
                        <div className="report-page__empty">
                            <div className="report-page__empty-title">{t('reports.inventory.details.emptyTitle')}</div>
                            <div>{t('reports.inventory.details.emptyDescription')}</div>
                        </div>
                    )}
                    {selected && groupBy === 'detail' && isMovementDetail(selected) && (
                        <div className="report-page__section">
                            <div>
                                <div className="report-page__transactions-title">
                                    {selected.product_name || t('reports.inventory.details.movementFallback')}
                                </div>
                                <div className="report-page__transactions-subtitle">
                                    {t('reports.inventory.details.movementSubtitle', {
                                        date: formatDateTimeValue(selected.date),
                                        type: selected.type,
                                        quantity: formatNumberValue(selected.quantity)
                                    })}
                                </div>
                            </div>
                            <div className="report-page__pill">
                                {t('reports.inventory.details.branchLabel', { branch: selected.branch_name || t('common.unassigned') })}
                            </div>
                            <div className="report-page__pill">
                                {t('reports.inventory.details.reasonLabel', { reason: selected.reason || t('common.placeholder') })}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={!selected.journal_entry_id}
                                onClick={() => selected.journal_entry_id && navigate(`/journals/${selected.journal_entry_id}`)}
                            >
                                {t('common.viewJournalEntry')}
                            </Button>
                        </div>
                    )}
                    {selected && groupBy !== 'detail' && (
                        <div className="report-page__section">
                            <div>
                                <div className="report-page__transactions-title">
                                    {(selected as InventoryReportItem).label}
                                </div>
                                <div className="report-page__transactions-subtitle">
                                    {t('reports.inventory.details.groupSubtitle')}
                                </div>
                            </div>
                            {transactionError && <div className="report-page__error">{transactionError}</div>}
                            {isLoadingTransactions && <div className="report-page__loading">{t('reports.inventory.details.loading')}</div>}
                            <Table data={transactions} columns={transactionColumns} isLoading={isLoadingTransactions} />
                            {!isLoadingTransactions && !transactionError && transactions.length === 0 && (
                                <div className="report-page__empty">{t('reports.inventory.details.empty')}</div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default ReportsInventoryPage;

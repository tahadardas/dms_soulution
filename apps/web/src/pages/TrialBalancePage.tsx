import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, DateRangePicker, PageHeader, Select, Table, Column } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { Branch } from '../types/inventory';
import { TrialBalanceReport, TrialBalanceRow } from '../types/accountingReports';
import { useCurrency } from '../hooks/useCurrency';
import { formatMoney, normalizeLocale } from '../utils/format';
import '../styles/TrialBalancePage.css';

type PeriodOption = 'month' | 'last-month' | 'quarter' | 'year' | 'custom';
type GroupOption = 'none' | 'type';

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

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

const getRangeForPeriod = (period: PeriodOption) => {
    const now = new Date();
    if (period === 'last-month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10)
        };
    }
    if (period === 'quarter') {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const start = new Date(now.getFullYear(), quarterStartMonth, 1);
        const end = now;
        return {
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10)
        };
    }
    if (period === 'year') {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = now;
        return {
            startDate: start.toISOString().slice(0, 10),
            endDate: end.toISOString().slice(0, 10)
        };
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10)
    };
};

interface TrialBalancePageProps {
    title?: string;
    subtitle?: string;
    showBackButton?: boolean;
}

export const TrialBalancePage: React.FC<TrialBalancePageProps> = ({
    title,
    subtitle,
    showBackButton = true
}) => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    const currency = useCurrency();
    const [branches, setBranches] = useState<Branch[]>([]);
    const [report, setReport] = useState<TrialBalanceReport | null>(null);
    const [period, setPeriod] = useState<PeriodOption>('month');
    const [groupBy, setGroupBy] = useState<GroupOption>('none');
    const [branchId, setBranchId] = useState('');
    const [range, setRange] = useState(() => getRangeForPeriod('month'));
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const resolvedTitle = title ?? t('reports.trialBalance.title');
    const resolvedSubtitle = subtitle ?? t('reports.trialBalance.subtitle');

    const formatMoneyValue = useCallback(
        (value: number) => formatMoney(value, currency, locale),
        [currency, locale]
    );

    const typeLabels = useMemo(() => ({
        ASSET: t('accounts.types.asset'),
        LIABILITY: t('accounts.types.liability'),
        EQUITY: t('accounts.types.equity'),
        REVENUE: t('accounts.types.revenue'),
        EXPENSE: t('accounts.types.expense')
    }), [t]);

    const loadBranches = useCallback(async () => {
        try {
            const data = await api<{ items: Branch[] }>('/branches');
            setBranches(data.items || []);
        } catch {
            setBranches([]);
        }
    }, [api]);

    const loadTrialBalance = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            if (branchId) params.set('branchId', branchId);
            const data = await api<TrialBalanceReport>(`/accounting/reports/trial-balance?${params.toString()}`);
            setReport(data);
        } catch (err: any) {
            setError(err?.message || t('errors.reports.trialBalanceLoadFailed'));
            setReport(null);
        } finally {
            setIsLoading(false);
        }
    }, [api, branchId, range, t]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    useEffect(() => {
        loadTrialBalance();
    }, [loadTrialBalance]);

    const handlePeriodChange = (value: PeriodOption) => {
        setPeriod(value);
        if (value !== 'custom') {
            setRange(getRangeForPeriod(value));
        }
    };

    const handleRangeChange = (value: { startDate: string; endDate: string }) => {
        setRange(value);
        if (period !== 'custom') {
            setPeriod('custom');
        }
    };

    const totals = report?.totals || { total_debit: 0, total_credit: 0, net_balance: 0 };
    const imbalance = Math.abs(totals.total_debit - totals.total_credit);

    const groupedItems = useMemo(() => {
        if (!report) return [];
        if (groupBy === 'type') {
            const map = new Map<string, TrialBalanceRow[]>();
            report.items.forEach((row) => {
                const key = row.type || 'OTHER';
                const existing = map.get(key) || [];
                existing.push(row);
                map.set(key, existing);
            });
            return Array.from(map.entries())
                .sort(([a], [b]) => {
                    const aIndex = TYPE_ORDER.indexOf(a);
                    const bIndex = TYPE_ORDER.indexOf(b);
                    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
                    if (aIndex === -1) return 1;
                    if (bIndex === -1) return -1;
                    return aIndex - bIndex;
                })
                .map(([type, rows]) => ({
                    type,
                    label: typeLabels[type as keyof typeof typeLabels] || type,
                    rows
                }));
        }
        return [{ type: 'ALL', label: t('reports.trialBalance.group.all'), rows: report.items }];
    }, [groupBy, report, t, typeLabels]);

    const columns: Column<TrialBalanceRow>[] = useMemo(() => {
        const base: Column<TrialBalanceRow>[] = [
            {
                header: t('reports.trialBalance.table.code'),
                accessorKey: 'code' as keyof TrialBalanceRow,
                cell: (row: TrialBalanceRow) => row.code
            },
            {
                header: t('reports.trialBalance.table.account'),
                accessorKey: 'name',
                cell: (row: TrialBalanceRow) => row.name
            },
            {
                header: t('reports.trialBalance.table.type'),
                accessorKey: 'type',
                cell: (row: TrialBalanceRow) => typeLabels[row.type as keyof typeof typeLabels] || row.type
            },
            {
                header: t('reports.trialBalance.table.debit'),
                accessorKey: 'total_debit',
                cell: (row: TrialBalanceRow) => formatMoneyValue(row.total_debit)
            },
            {
                header: t('reports.trialBalance.table.credit'),
                accessorKey: 'total_credit',
                cell: (row: TrialBalanceRow) => formatMoneyValue(row.total_credit)
            },
            {
                header: t('reports.trialBalance.table.net'),
                accessorKey: 'net_balance',
                cell: (row: TrialBalanceRow) => formatMoneyValue(row.net_balance)
            }
        ];
        if (groupBy === 'type') {
            return base.filter((col) => col.accessorKey !== 'type');
        }
        return base;
    }, [formatMoneyValue, groupBy, t, typeLabels]);

    const handleExport = () => {
        if (!report) return;
        const header = [
            t('reports.trialBalance.table.code'),
            t('reports.trialBalance.table.account'),
            t('reports.trialBalance.table.type'),
            t('reports.trialBalance.table.debit'),
            t('reports.trialBalance.table.credit'),
            t('reports.trialBalance.table.net')
        ];
        const rows = report.items.map((row) => [
            row.code,
            row.name,
            typeLabels[row.type as keyof typeof typeLabels] || row.type,
            formatMoneyValue(row.total_debit),
            formatMoneyValue(row.total_credit),
            formatMoneyValue(row.net_balance)
        ]);
        const csv = [header, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `trial-balance-${range.startDate}-${range.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="trial-balance-page">
            <PageHeader
                title={resolvedTitle}
                subtitle={resolvedSubtitle}
                backButton={showBackButton ? <BackButton /> : undefined}
                actions={(
                    <div className="trial-balance-page__actions">
                        <Button variant="secondary" onClick={handleExport} disabled={!report || report.items.length === 0}>
                            {t('common.exportCsv')}
                        </Button>
                        <Button variant="ghost" onClick={() => window.print()} disabled={!report}>
                            {t('common.print')}
                        </Button>
                    </div>
                )}
            />

            {error && <div className="trial-balance-page__error">{error}</div>}
            {isLoading && <div className="trial-balance-page__loading">{t('reports.trialBalance.loading')}</div>}

            <div className="trial-balance-page__filters">
                <Select
                    label={t('reports.trialBalance.filters.period')}
                    value={period}
                    onChange={(event) => handlePeriodChange(event.target.value as PeriodOption)}
                >
                    <option value="month">{t('reports.trialBalance.filters.periodOptions.month')}</option>
                    <option value="last-month">{t('reports.trialBalance.filters.periodOptions.lastMonth')}</option>
                    <option value="quarter">{t('reports.trialBalance.filters.periodOptions.quarter')}</option>
                    <option value="year">{t('reports.trialBalance.filters.periodOptions.year')}</option>
                    <option value="custom">{t('reports.trialBalance.filters.periodOptions.custom')}</option>
                </Select>
                <Select
                    label={t('common.groupBy')}
                    value={groupBy}
                    onChange={(event) => setGroupBy(event.target.value as GroupOption)}
                >
                    <option value="none">{t('common.none')}</option>
                    <option value="type">{t('reports.trialBalance.filters.groupByType')}</option>
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
                <div className="trial-balance-page__range">
                    <DateRangePicker
                        value={range}
                        onChange={handleRangeChange}
                        startLabel={t('common.startDate')}
                        endLabel={t('common.endDate')}
                        separatorLabel={t('common.to')}
                    />
                </div>
            </div>

            <div className="trial-balance-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('reports.trialBalance.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="trial-balance-page__summary-grid">
                            <div>
                                <div className="trial-balance-page__summary-label">{t('reports.trialBalance.summary.accounts')}</div>
                                <div className="trial-balance-page__summary-value">{report?.items?.length || 0}</div>
                            </div>
                            <div>
                                <div className="trial-balance-page__summary-label">{t('reports.trialBalance.summary.totalDebits')}</div>
                                <div className="trial-balance-page__summary-value">{formatMoneyValue(totals.total_debit)}</div>
                            </div>
                            <div>
                                <div className="trial-balance-page__summary-label">{t('reports.trialBalance.summary.totalCredits')}</div>
                                <div className="trial-balance-page__summary-value">{formatMoneyValue(totals.total_credit)}</div>
                            </div>
                            <div>
                                <div className="trial-balance-page__summary-label">{t('reports.trialBalance.summary.outOfBalance')}</div>
                                <div className="trial-balance-page__summary-value">{formatMoneyValue(imbalance)}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.trialBalance.results.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {groupedItems.map((group) => (
                        <div key={group.type} className="trial-balance-page__group">
                            {groupBy === 'type' && (
                                <div className="trial-balance-page__group-title">{group.label}</div>
                            )}
                            <Table
                                data={group.rows}
                                columns={columns}
                                isLoading={isLoading}
                                onRowClick={(row: TrialBalanceRow) => {
                                    const params = new URLSearchParams();
                                    params.set('accountId', String(row.id));
                                    params.set('startDate', range.startDate);
                                    params.set('endDate', range.endDate);
                                    if (branchId) params.set('branchId', branchId);
                                    navigate(`/ledger?${params.toString()}`);
                                }}
                            />
                        </div>
                    ))}
                    {!isLoading && !error && (!report || report.items.length === 0) && (
                        <div className="trial-balance-page__empty">
                            {t('reports.trialBalance.empty')}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default TrialBalancePage;

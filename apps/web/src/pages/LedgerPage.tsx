import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, DateRangePicker, PageHeader, Select, Table, Column } from '@dms/ui';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { Account } from '../types/accounting';
import { LedgerReport, LedgerLine } from '../types/accountingReports';
import { Branch } from '../types/inventory';
import { useCurrency } from '../hooks/useCurrency';
import { formatDate, formatMoney, normalizeLocale } from '../utils/format';
import '../styles/LedgerPage.css';

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

const getDefaultRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10)
    };
};

export const LedgerPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    const currency = useCurrency();
    const [searchParams] = useSearchParams();
    const defaultRange = getDefaultRange();
    const initialAccountId = searchParams.get('accountId') || '';
    const initialBranchId = searchParams.get('branchId') || '';
    const initialSourceType = searchParams.get('sourceType') || '';
    const initialRange = {
        startDate: searchParams.get('startDate') || defaultRange.startDate,
        endDate: searchParams.get('endDate') || defaultRange.endDate
    };
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [accountId, setAccountId] = useState(initialAccountId);
    const [branchId, setBranchId] = useState(initialBranchId);
    const [sourceType, setSourceType] = useState(initialSourceType);
    const [range, setRange] = useState(initialRange);
    const [report, setReport] = useState<LedgerReport | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const sourceTypeOptions = useMemo(() => ([
        { value: '', label: t('reports.ledger.sourceTypes.all') },
        { value: 'MANUAL', label: t('reports.ledger.sourceTypes.manual') },
        { value: 'POS_SALES', label: t('reports.ledger.sourceTypes.posSales') },
        { value: 'POS_RETURNS', label: t('reports.ledger.sourceTypes.posReturns') },
        { value: 'INVENTORY', label: t('reports.ledger.sourceTypes.inventory') },
        { value: 'SYSTEM', label: t('reports.ledger.sourceTypes.system') },
        { value: 'REVERSAL', label: t('reports.ledger.sourceTypes.reversal') }
    ]), [t]);

    const formatDateValue = useCallback(
        (value: string) => formatDate(value, locale, { month: 'short', day: 'numeric', year: 'numeric' }),
        [locale]
    );

    const formatMoneyValue = useCallback(
        (value: number) => formatMoney(value, currency, locale),
        [currency, locale]
    );

    const formatEntryId = useCallback((value: string) => (
        value?.split('-')[0]?.toUpperCase() || t('common.placeholder')
    ), [t]);

    const loadAccounts = useCallback(async () => {
        try {
            const data = await api<{ items: Account[] }>('/accounting/accounts');
            setAccounts(data.items || []);
        } catch {
            setAccounts([]);
        }
    }, [api]);

    const loadBranches = useCallback(async () => {
        try {
            const data = await api<{ items: Branch[] }>('/branches');
            setBranches(data.items || []);
        } catch {
            setBranches([]);
        }
    }, [api]);

    const loadLedger = useCallback(async () => {
        if (!accountId) {
            setReport(null);
            setError('');
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('accountId', accountId);
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            if (branchId) params.set('branchId', branchId);
            if (sourceType) params.set('sourceType', sourceType);
            const data = await api<LedgerReport>(`/accounting/reports/ledger?${params.toString()}`);
            setReport(data);
        } catch (err: any) {
            setError(err?.message || t('errors.reports.ledgerLoadFailed'));
            setReport(null);
        } finally {
            setIsLoading(false);
        }
    }, [accountId, api, branchId, range, sourceType, t]);

    useEffect(() => {
        loadAccounts();
        loadBranches();
    }, [loadAccounts, loadBranches]);

    useEffect(() => {
        loadLedger();
    }, [loadLedger]);

    useEffect(() => {
        const accountParam = searchParams.get('accountId');
        const startParam = searchParams.get('startDate');
        const endParam = searchParams.get('endDate');
        const branchParam = searchParams.get('branchId');
        const sourceParam = searchParams.get('sourceType');

        if (accountParam !== null && accountParam !== accountId) {
            setAccountId(accountParam);
        }
        if (branchParam !== null && branchParam !== branchId) {
            setBranchId(branchParam);
        }
        if (sourceParam !== null && sourceParam !== sourceType) {
            setSourceType(sourceParam);
        }
        if (startParam && endParam) {
            setRange({ startDate: startParam, endDate: endParam });
        }
    }, [accountId, branchId, searchParams, sourceType]);

    const summary = useMemo(() => {
        if (!report) {
            return {
                opening: 0,
                debit: 0,
                credit: 0,
                closing: 0
            };
        }
        return {
            opening: report.openingBalance || 0,
            debit: report.totalDebit || 0,
            credit: report.totalCredit || 0,
            closing: report.closingBalance || 0
        };
    }, [report]);

    const columns: Column<LedgerLine & { id: string }>[] = useMemo(
        () => [
            {
                header: t('reports.ledger.table.date'),
                accessorKey: 'date',
                cell: (row: LedgerLine) => formatDateValue(row.date)
            },
            {
                header: t('reports.ledger.table.entry'),
                accessorKey: 'entry_id',
                cell: (row: LedgerLine) => formatEntryId(row.entry_id)
            },
            {
                header: t('reports.ledger.table.description'),
                accessorKey: 'entry_description',
                cell: (row: LedgerLine) => (
                    <div className="ledger-page__desc">
                        <div className="ledger-page__title">{row.entry_description}</div>
                        <div className="ledger-page__meta">
                            {[
                                row.line_description || t('reports.ledger.meta.posting'),
                                row.source_type ? t('reports.ledger.meta.sourceType', { type: row.source_type }) : null,
                                row.source_id ? t('reports.ledger.meta.sourceId', { id: row.source_id }) : null
                            ].filter(Boolean).join(' - ')}
                        </div>
                    </div>
                )
            },
            {
                header: t('reports.ledger.table.debit'),
                accessorKey: 'debit',
                cell: (row: LedgerLine) => formatMoneyValue(row.debit)
            },
            {
                header: t('reports.ledger.table.credit'),
                accessorKey: 'credit',
                cell: (row: LedgerLine) => formatMoneyValue(row.credit)
            },
            {
                header: t('reports.ledger.table.balance'),
                accessorKey: 'running_balance',
                cell: (row: LedgerLine) => formatMoneyValue(row.running_balance)
            }
        ],
        [formatDateValue, formatEntryId, formatMoneyValue, t]
    );

    const handleExport = () => {
        if (!report) return;
        const header = [
            t('reports.ledger.table.date'),
            t('reports.ledger.table.entry'),
            t('reports.ledger.table.description'),
            t('reports.ledger.export.line'),
            t('reports.ledger.export.source'),
            t('reports.ledger.table.debit'),
            t('reports.ledger.table.credit'),
            t('reports.ledger.table.balance')
        ];
        const rows = report.items.map((row) => [
            formatDateValue(row.date),
            formatEntryId(row.entry_id),
            row.entry_description,
            row.line_description || '',
            `${row.source_type || ''}${row.source_id ? ` ${row.source_id}` : ''}`.trim(),
            formatMoneyValue(row.debit),
            formatMoneyValue(row.credit),
            formatMoneyValue(row.running_balance)
        ]);
        const csv = [header, ...rows].map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ledger-${accountId}-${range.startDate}-${range.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="ledger-page">
            <PageHeader
                title={t('reports.ledger.title')}
                subtitle={t('reports.ledger.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <div className="ledger-page__actions">
                        <Button variant="secondary" onClick={handleExport} disabled={!report || report.items.length === 0}>
                            {t('common.exportCsv')}
                        </Button>
                        <Button variant="ghost" onClick={() => window.print()} disabled={!report}>
                            {t('common.print')}
                        </Button>
                    </div>
                )}
            />

            {error && <div className="ledger-page__error">{error}</div>}
            {isLoading && <div className="ledger-page__loading">{t('reports.ledger.loading')}</div>}

            <div className="ledger-page__filters">
                <Select
                    label={t('reports.ledger.filters.account')}
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                >
                    <option value="">{t('reports.ledger.filters.accountPlaceholder')}</option>
                    {accounts.map((account) => (
                        <option key={account.id} value={account.id}>
                            {account.code} - {account.name}
                        </option>
                    ))}
                </Select>
                <Select
                    label={t('reports.ledger.filters.journalType')}
                    value={sourceType}
                    onChange={(event) => setSourceType(event.target.value)}
                >
                    {sourceTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
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
                <div className="ledger-page__range">
                    <DateRangePicker
                        value={range}
                        onChange={setRange}
                        startLabel={t('common.startDate')}
                        endLabel={t('common.endDate')}
                        separatorLabel={t('common.to')}
                    />
                </div>
            </div>

            <div className="ledger-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('reports.ledger.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="ledger-page__summary-grid">
                            <div>
                                <div className="ledger-page__summary-label">{t('reports.ledger.summary.opening')}</div>
                                <div className="ledger-page__summary-value">{formatMoneyValue(summary.opening)}</div>
                            </div>
                            <div>
                                <div className="ledger-page__summary-label">{t('reports.ledger.summary.debits')}</div>
                                <div className="ledger-page__summary-value">{formatMoneyValue(summary.debit)}</div>
                            </div>
                            <div>
                                <div className="ledger-page__summary-label">{t('reports.ledger.summary.credits')}</div>
                                <div className="ledger-page__summary-value">{formatMoneyValue(summary.credit)}</div>
                            </div>
                            <div>
                                <div className="ledger-page__summary-label">{t('reports.ledger.summary.closing')}</div>
                                <div className="ledger-page__summary-value">{formatMoneyValue(summary.closing)}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.ledger.results.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {accountId ? (
                        <>
                            <Table
                                data={(report?.items || []).map(item => ({ ...item, id: item.entry_id }))}
                                columns={columns}
                                isLoading={isLoading}
                                onRowClick={(row) => navigate(`/journals/${row.entry_id}`)}
                            />
                            {!isLoading && !error && report?.items?.length === 0 && (
                                <div className="ledger-page__empty">
                                    {t('reports.ledger.empty')}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="ledger-page__empty">
                            {t('reports.ledger.emptyAccount')}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LedgerPage;

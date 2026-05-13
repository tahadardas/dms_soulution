import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, DateRangePicker, Input, PageHeader, Select, StatusBadge, Table, Column } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { JournalEntry } from '../types/journal';
import { useTranslation } from 'react-i18next';
import '../styles/JournalsPage.css';

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

export const JournalsPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'posted'>('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [range, setRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return {
            startDate: start.toISOString().slice(0, 10),
            endDate: now.toISOString().slice(0, 10)
        };
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            const trimmed = search.trim();
            setDebouncedSearch(trimmed.length >= 2 ? trimmed : '');
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    const loadEntries = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (debouncedSearch) params.set('search', debouncedSearch);
            const data = await api<{ items: JournalEntry[] }>(`/accounting/entries?${params.toString()}`);
            setEntries(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.journals.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, debouncedSearch, range, statusFilter, t]);

    useEffect(() => {
        loadEntries();
    }, [loadEntries]);

    const summary = useMemo(() => {
        let drafts = 0;
        let posted = 0;
        let unbalanced = 0;
        entries.forEach((entry) => {
            const debit = entry.total_debit || 0;
            const credit = entry.total_credit || 0;
            if (entry.posted) {
                posted += 1;
            } else {
                drafts += 1;
            }
            if (Math.abs(debit - credit) > 0.001) {
                unbalanced += 1;
            }
        });
        return { drafts, posted, unbalanced };
    }, [entries]);

    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const formatDate = useCallback((value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    }, [locale]);

    const columns: Column<JournalEntry>[] = useMemo(
        () => [
            {
                header: t('journals.table.date'),
                accessorKey: 'date',
                cell: (row: JournalEntry) => formatDate(row.date)
            },
            {
                header: t('journals.table.description'),
                accessorKey: 'description',
                cell: (row: JournalEntry) => (
                    <div className="journals-table__desc">
                        <div className="journals-table__title">{row.description}</div>
                        {row.source_type && (
                            <div className="journals-table__meta">
                                {t('journals.table.source', { type: row.source_type, id: row.source_id })}
                            </div>
                        )}
                    </div>
                )
            },
            {
                header: t('common.status'),
                accessorKey: 'posted',
                cell: (row: JournalEntry) => (
                    <StatusBadge variant={row.posted ? 'success' : 'warning'} size="sm">
                        {row.posted ? t('journals.status.posted') : t('journals.status.draft')}
                    </StatusBadge>
                )
            },
            {
                header: t('journals.table.debit'),
                accessorKey: 'total_debit',
                cell: (row: JournalEntry) => (row.total_debit ?? 0).toFixed(2)
            },
            {
                header: t('journals.table.credit'),
                accessorKey: 'total_credit',
                cell: (row: JournalEntry) => (row.total_credit ?? 0).toFixed(2)
            }
        ],
        [formatDate, t]
    );

    return (
        <div className="journals-page">
            <PageHeader
                title={t('nav.routes.journals.title')}
                subtitle={t('nav.routes.journals.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.ACC_CREATE_JOURNAL}
                        tooltip={t('errors.journals.createDenied')}
                    >
                        <Button variant="primary" onClick={() => navigate('/journals/new')}>
                            {t('journals.actions.new')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="journals-page__error">{error}</div>}
            {isLoading && <div className="journals-page__loading">{t('journals.loading')}</div>}

            <div className="journals-page__filters">
                <Input
                    label={t('common.search')}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t('journals.searchPlaceholder')}
                />
                <Select
                    label={t('common.status')}
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'all' | 'draft' | 'posted')}
                >
                    <option value="all">{t('common.all')}</option>
                    <option value="draft">{t('journals.status.draft')}</option>
                    <option value="posted">{t('journals.status.posted')}</option>
                </Select>
                <div className="journals-page__range">
                    <DateRangePicker
                        value={range}
                        onChange={setRange}
                        startLabel={t('common.startDate')}
                        endLabel={t('common.endDate')}
                        separatorLabel={t('common.to')}
                    />
                </div>
            </div>

            <div className="journals-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('journals.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="journals-page__summary-grid">
                            <div>
                                <div className="journals-page__summary-label">{t('journals.summary.drafts')}</div>
                                <div className="journals-page__summary-value">{summary.drafts}</div>
                            </div>
                            <div>
                                <div className="journals-page__summary-label">{t('journals.summary.posted')}</div>
                                <div className="journals-page__summary-value">{summary.posted}</div>
                            </div>
                            <div>
                                <div className="journals-page__summary-label">{t('journals.summary.unbalanced')}</div>
                                <div className="journals-page__summary-value">{summary.unbalanced}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('journals.table.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table
                        data={entries}
                        columns={columns}
                        isLoading={isLoading}
                        onRowClick={(row) => navigate(`/journals/${row.id}`)}
                    />
                    {!isLoading && entries.length === 0 && (
                        <div className="journals-page__empty">{t('journals.empty')}</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default JournalsPage;

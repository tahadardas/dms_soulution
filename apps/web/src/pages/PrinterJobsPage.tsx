import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Select, StatusBadge, Table, useToast, Column } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { useTranslation } from 'react-i18next';
import { PrintJob } from '../types/printing';
import '../styles/PrinterJobsPage.css';

const STATUS_OPTIONS = ['PENDING', 'LOCKED', 'PRINTING', 'SUCCESS', 'FAILED', 'CANCELLED'];
const TYPE_OPTIONS = ['KOT', 'RECEIPT', 'REPORT'];

const PrinterJobsPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const [jobs, setJobs] = useState<PrintJob[]>([]);
    const [status, setStatus] = useState('');
    const [type, setType] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const statusLabels = useMemo(() => ({
        PENDING: t('settings.printing.jobs.status.pending'),
        LOCKED: t('settings.printing.jobs.status.locked'),
        PRINTING: t('settings.printing.jobs.status.printing'),
        SUCCESS: t('settings.printing.jobs.status.success'),
        FAILED: t('settings.printing.jobs.status.failed'),
        CANCELLED: t('settings.printing.jobs.status.cancelled')
    }), [t]);

    const typeLabels = useMemo(() => ({
        KOT: t('settings.printing.jobs.types.kot'),
        RECEIPT: t('settings.printing.jobs.types.receipt'),
        REPORT: t('settings.printing.jobs.types.report')
    }), [t]);

    const formatDateTime = useCallback((value?: string | null) => {
        if (!value) return t('common.placeholder');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat(locale, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }, [locale, t]);
    const loadJobs = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (status) params.set('status', status);
            if (type) params.set('type', type);
            const data = await api<{ items: PrintJob[] }>(`/printing/jobs?${params.toString()}`);
            setJobs(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.printJobs.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, status, type, t]);

    useEffect(() => {
        loadJobs();
    }, [loadJobs]);

    const handleRetry = async (jobId: string) => {
        try {
            await api(`/printing/jobs/${jobId}/retry`, { method: 'POST' });
            toast.success(t('toast.printJobs.retryQueued'));
            loadJobs();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printJobs.retryFailed'));
        }
    };

    const handleProcessQueue = async () => {
        try {
            await api('/printing/process-queue', { method: 'POST' });
            toast.success(t('toast.printJobs.processingStarted'));
            loadJobs();
        } catch (err: any) {
            toast.error(err?.message || t('errors.printJobs.processFailed'));
        }
    };

    const summary = useMemo(() => {
        const queued = jobs.filter(job => job.status === 'PENDING' || job.status === 'LOCKED' || job.status === 'PRINTING').length;
        const failed = jobs.filter(job => job.status === 'FAILED').length;
        const completed = jobs.filter(job => job.status === 'SUCCESS').length;
        return { queued, failed, completed };
    }, [jobs]);

    const columns: Column<PrintJob>[] = useMemo(
        () => [
            {
                header: t('settings.printing.jobs.table.time'),
                accessorKey: 'created_at',
                cell: (row: PrintJob) => formatDateTime(row.created_at)
            },
            {
                header: t('settings.printing.jobs.table.type'),
                accessorKey: 'type',
                cell: (row: PrintJob) => typeLabels[row.type as keyof typeof typeLabels] || row.type
            },
            {
                header: t('settings.printing.jobs.table.printer'),
                accessorKey: 'printer_name',
                cell: (row: PrintJob) => row.printer_name || `#${row.printer_id}`
            },
            {
                header: t('settings.printing.jobs.table.status'),
                accessorKey: 'status',
                cell: (row: PrintJob) => (
                    <StatusBadge variant={row.status === 'FAILED' ? 'danger' : row.status === 'SUCCESS' ? 'success' : 'warning'} size="sm">
                        {statusLabels[row.status as keyof typeof statusLabels] || row.status}
                    </StatusBadge>
                )
            },
            {
                header: t('settings.printing.jobs.table.attempts'),
                accessorKey: 'attempts',
                cell: (row: PrintJob) => row.attempts ?? row.retries ?? 0
            },
            {
                header: t('settings.printing.jobs.table.lastError'),
                accessorKey: 'error_message',
                cell: (row: PrintJob) => row.error_message || row.last_error || t('common.placeholder')
            },
            {
                header: t('common.actions'),
                accessorKey: 'id',
                cell: (row: PrintJob) => (
                    <div className="printer-jobs-page__actions">
                        {row.status === 'FAILED' && (
                            <PermissionGate
                                perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                                tooltip={t('errors.printJobs.retryDenied')}
                            >
                                <Button variant="secondary" size="sm" onClick={() => handleRetry(row.id)}>
                                    {t('settings.printing.jobs.actions.retry')}
                                </Button>
                            </PermissionGate>
                        )}
                    </div>
                )
            }
        ],
        [formatDateTime, statusLabels, t, typeLabels]
    );

    return (
        <div className="printer-jobs-page">
            <PageHeader
                title={t('settings.printing.jobs.title')}
                subtitle={t('settings.printing.jobs.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.SET_MANAGE_PRINTERS}
                        tooltip={t('errors.printJobs.processDenied')}
                    >
                        <Button variant="secondary" onClick={handleProcessQueue}>
                            {t('settings.printing.jobs.actions.processQueue')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="printer-jobs-page__error">{error}</div>}
            {isLoading && <div className="printer-jobs-page__loading">{t('settings.printing.jobs.loading')}</div>}

            <div className="printer-jobs-page__filters">
                <Select label={t('settings.printing.jobs.filters.status')} value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="">{t('settings.printing.jobs.filters.allStatuses')}</option>
                    {STATUS_OPTIONS.map((option) => (
                        <option key={option} value={option}>{statusLabels[option as keyof typeof statusLabels] || option}</option>
                    ))}
                </Select>
                <Select label={t('settings.printing.jobs.filters.type')} value={type} onChange={(event) => setType(event.target.value)}>
                    <option value="">{t('settings.printing.jobs.filters.allTypes')}</option>
                    {TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{typeLabels[option as keyof typeof typeLabels] || option}</option>
                    ))}
                </Select>
                <Button variant="ghost" onClick={loadJobs}>
                    {t('common.refresh')}
                </Button>
            </div>

            <div className="printer-jobs-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('settings.printing.jobs.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="printer-jobs-page__summary-grid">
                            <div>
                                <div className="printer-jobs-page__summary-label">{t('settings.printing.jobs.summary.queued')}</div>
                                <div className="printer-jobs-page__summary-value">{summary.queued}</div>
                            </div>
                            <div>
                                <div className="printer-jobs-page__summary-label">{t('settings.printing.jobs.summary.failed')}</div>
                                <div className="printer-jobs-page__summary-value">{summary.failed}</div>
                            </div>
                            <div>
                                <div className="printer-jobs-page__summary-label">{t('settings.printing.jobs.summary.completed')}</div>
                                <div className="printer-jobs-page__summary-value">{summary.completed}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.printing.jobs.table.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table data={jobs} columns={columns} isLoading={isLoading} />
                    {!isLoading && jobs.length === 0 && (
                        <div className="printer-jobs-page__empty">{t('settings.printing.jobs.empty')}</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default PrinterJobsPage;

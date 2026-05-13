import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    Button, Card, CardContent, CardHeader,
    Input, PageHeader, StatusBadge, 
    Table, Column, Select, DateRangePicker, Modal
} from '@dms/ui';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import { formatDateTime, normalizeLocale } from '../utils/format';

interface AuditLog {
    id: number;
    user_id: number | null;
    username: string | null;
    action: string;
    branch_id: number | null;
    branch_name: string | null;
    details: string;
    created_at: string;
}

const getInitialRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    return {
        startDate: start.toISOString().slice(0, 10),
        endDate: now.toISOString().slice(0, 10)
    };
};

const AuditLogsPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const api = useApi();
    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('');
    const [range, setRange] = useState(getInitialRange);
    const [limit, setLimit] = useState('100');
    
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('limit', limit);
            
            const start = new Date(range.startDate);
            start.setHours(0, 0, 0, 0);
            params.set('startDate', start.toISOString());
            
            const end = new Date(range.endDate);
            end.setHours(23, 59, 59, 999);
            params.set('endDate', end.toISOString());

            const data = await api<AuditLog[]>(`/admin/audit-logs?${params.toString()}`);
            setLogs(data || []);
        } catch (err: any) {
            console.error('Failed to fetch audit logs', err);
        } finally {
            setLoading(false);
        }
    }, [api, limit, range]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const uniqueActions = useMemo(() => {
        const actions = new Set(logs.map(l => l.action));
        return Array.from(actions).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesSearch = 
                (log.username?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                (log.details?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
                log.action.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesAction = filterAction === '' || log.action === filterAction;
            
            return matchesSearch && matchesAction;
        });
    }, [logs, searchTerm, filterAction]);

    const handleExport = () => {
        if (filteredLogs.length === 0) return;
        
        const header = [
            t('audit.fields.timestamp'),
            t('audit.fields.user'),
            t('audit.fields.action'),
            t('common.branch'),
            t('audit.fields.details')
        ];
        
        const rows = filteredLogs.map(log => [
            new Date(log.created_at).toLocaleString(),
            log.username || 'System',
            log.action,
            log.branch_name || '-',
            log.details
        ]);
        
        const csv = [header, ...rows]
            .map(line => line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            .join('\n');
            
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-logs-${range.startDate}-to-${range.endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const getActionVariant = (action: string) => {
        const act = action.toUpperCase();
        if (act.includes('DELETE') || act.includes('VOID') || act.includes('REMOVE') || act.includes('FAIL')) return 'danger';
        if (act.includes('UPDATE') || act.includes('EDIT') || act.includes('CHANGE')) return 'warning';
        if (act.includes('CREATE') || act.includes('ADD') || act.includes('POST')) return 'success';
        return 'info';
    };

    const columns: Column<AuditLog>[] = useMemo(() => [
        {
            header: t('audit.fields.timestamp'),
            accessorKey: 'created_at',
            cell: (row) => (
                <div style={{ whiteSpace: 'nowrap', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {formatDateTime(row.created_at, locale, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                    })}
                </div>
            )
        },
        {
            header: t('audit.fields.user'),
            accessorKey: 'username',
            cell: (row) => (
                <div style={{ fontWeight: 600 }}>{row.username || 'System'}</div>
            )
        },
        {
            header: t('audit.fields.action'),
            accessorKey: 'action',
            cell: (row) => (
                <StatusBadge variant={getActionVariant(row.action)} size="sm">
                    {row.action}
                </StatusBadge>
            )
        },
        {
            header: t('common.branch'),
            accessorKey: 'branch_name',
            cell: (row) => row.branch_name || <span style={{ color: 'var(--text-muted)' }}>-</span>
        },
        {
            header: t('audit.fields.details'),
            accessorKey: 'details',
            cell: (row) => {
                let displayDetails = row.details;
                try {
                    const parsed = JSON.parse(row.details);
                    displayDetails = JSON.stringify(parsed);
                } catch (e) {}
                
                return (
                    <div style={{ 
                        fontSize: 'var(--text-xs)', 
                        fontFamily: 'monospace',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        color: 'var(--primary-600)'
                    }} onClick={() => setSelectedLog(row)}>
                        {displayDetails}
                    </div>
                );
            }
        }
    ], [t, locale]);

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <PageHeader
                title={t('nav.routes.auditLogs.title')}
                subtitle={t('nav.routes.auditLogs.subtitle')}
                backButton={<BackButton />}
                actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <Button variant="secondary" onClick={handleExport} disabled={filteredLogs.length === 0}>
                            {t('common.exportCsv')}
                        </Button>
                        <Button variant="ghost" onClick={() => window.print()}>
                            {t('common.print')}
                        </Button>
                    </div>
                }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '24px' }}>
                <Card>
                    <CardHeader>
                        <div style={{ display: 'flex', gap: '16px', width: '100%', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: 1, minWidth: '250px' }}>
                                <Input
                                    label={t('common.search')}
                                    placeholder={t('common.searchPlaceholder')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div style={{ width: '200px' }}>
                                <Select
                                    label={t('audit.fields.action')}
                                    value={filterAction}
                                    onChange={(e) => setFilterAction(e.target.value)}
                                >
                                    <option value="">{t('audit.allActions')}</option>
                                    {uniqueActions.map(action => (
                                        <option key={action} value={action}>{action}</option>
                                    ))}
                                </Select>
                            </div>
                            <div style={{ minWidth: '300px' }}>
                                <DateRangePicker
                                    value={range}
                                    onChange={setRange}
                                    startLabel={t('common.startDate')}
                                    endLabel={t('common.endDate')}
                                    separatorLabel={t('common.to')}
                                />
                            </div>
                            <div style={{ width: '120px' }}>
                                <Select
                                    label={t('common.rowsCount', { count: Number(limit) }).trim()}
                                    value={limit}
                                    onChange={(e) => setLimit(e.target.value)}
                                >
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                    <option value="500">500</option>
                                    <option value="1000">1000</option>
                                </Select>
                            </div>
                            <Button variant="ghost" onClick={fetchLogs} isLoading={loading}>
                                {t('common.refresh')}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Table 
                            data={filteredLogs} 
                            columns={columns} 
                            isLoading={loading} 
                        />
                    </CardContent>
                </Card>
            </div>

            <Modal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title={t('audit.fields.details')}
            >
                {selectedLog && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('audit.fields.timestamp')}</label>
                                <div>{new Date(selectedLog.created_at).toLocaleString()}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('audit.fields.user')}</label>
                                <div>{selectedLog.username || 'System'}</div>
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('audit.fields.action')}</label>
                                <div>
                                    <StatusBadge variant={getActionVariant(selectedLog.action)}>
                                        {selectedLog.action}
                                    </StatusBadge>
                                </div>
                            </div>
                            <div>
                                <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t('common.branch')}</label>
                                <div>{selectedLog.branch_name || '-'}</div>
                            </div>
                        </div>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)' }} />
                        <div>
                            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                                {t('audit.fields.details')}
                            </label>
                            <pre style={{ 
                                padding: '16px', 
                                backgroundColor: 'var(--bg-secondary)', 
                                borderRadius: '8px',
                                overflow: 'auto',
                                fontSize: 'var(--text-sm)',
                                fontFamily: 'monospace',
                                border: '1px solid var(--border-color)'
                            }}>
                                {JSON.stringify(JSON.parse(selectedLog.details || '{}'), null, 2)}
                            </pre>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default AuditLogsPage;

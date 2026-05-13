import React, { useEffect, useState } from 'react';
import { 
    Card, 
    Button, 
    Table, 
    PageHeader, 
    useToast, 
    Modal,
    Input
} from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi';
import { useCurrencyFormatter } from '../hooks/useCurrencyFormatter';

interface Session {
    id: string;
    user_id: number;
    user_name: string;
    branch_id: number;
    branch_name: string;
    start_time: string;
    opening_cash: number;
    station_id?: string;
    stats: {
        totalSales: number;
        totalReturns: number;
        totalDiscounts: number;
        netAmount: number;
    };
    current_cash?: number;
}

const POSSessionsPage: React.FC = () => {
    const { t } = useTranslation();
    const api = useApi();
    const toast = useToast();
    const { formatCurrency } = useCurrencyFormatter();
    
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [closingSession, setClosingSession] = useState<Session | null>(null);
    const [closingCash, setClosingCash] = useState('');
    const [closingNotes, setClosingNotes] = useState('');
    const [closingReason, setClosingReason] = useState('');
    const [closingManagerUsername, setClosingManagerUsername] = useState('');
    const [closingManagerPassword, setClosingManagerPassword] = useState('');
    const [isClosing, setIsClosing] = useState(false);

    const loadSessions = async () => {
        setLoading(true);
        try {
            const data = await api<Session[]>('/pos/sessions/all');
            setSessions(data || []);
        } catch (err: any) {
            toast.error(err.message || t('errors.pos.loadSessionsFailed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, []);

    const handleCloseSession = async () => {
        if (!closingSession) return;
        setIsClosing(true);
        try {
            await api('/pos/sessions/close', {
                method: 'POST',
                body: JSON.stringify({ 
                    sessionId: closingSession.id, 
                    closingCash: parseFloat(closingCash) || 0, 
                    notes: closingNotes,
                    reason: closingReason,
                    managerUsername: closingManagerUsername || undefined,
                    managerPassword: closingManagerPassword || undefined
                })
            });
            toast.success(t('toast.pos.sessionClosed'));
            setClosingSession(null);
            setClosingCash('');
            setClosingNotes('');
            setClosingReason('');
            setClosingManagerUsername('');
            setClosingManagerPassword('');
            loadSessions();
        } catch (err: any) {
            toast.error(err.message || t('errors.pos.closeFailed'));
        } finally {
            setIsClosing(false);
        }
    };

    const columns = [
        {
            header: t('pos.user', 'User'),
            accessorKey: 'user_name'
        },
        {
            header: t('pos.branch', 'Branch'),
            accessorKey: 'branch_name'
        },
        {
            header: t('pos.station', 'Station'),
            cell: (row: Session) => row.station_id || '-'
        },
        {
            header: t('pos.startTime', 'Start Time'),
            cell: (row: Session) => new Date(row.start_time).toLocaleString()
        },
        {
            header: t('pos.openingCash', 'Opening'),
            cell: (row: Session) => formatCurrency(row.opening_cash)
        },
        {
            header: t('pos.currentCash', 'Current Cash'),
            cell: (row: Session) => (
                <span style={{ fontWeight: 'bold', color: '#10b981' }}>
                    {formatCurrency(row.opening_cash + row.stats.netAmount)}
                </span>
            )
        },
        {
            header: t('common.actions'),
            cell: (row: Session) => (
                <Button 
                    variant="danger" 
                    size="sm" 
                    onClick={() => {
                        setClosingSession(row);
                        setClosingCash((row.opening_cash + row.stats.netAmount).toString());
                    }}
                >
                    {t('pos.closeSession')}
                </Button>
            )
        }
    ];

    return (
        <div className="pos-sessions-page">
            <PageHeader 
                title={t('nav.routes.posSessions.title', 'Active Sessions')} 
                subtitle={t('nav.routes.posSessions.subtitle', 'Manage all active POS sessions')}
                actions={
                    <Button onClick={loadSessions} isLoading={loading}>
                        {t('common.refresh')}
                    </Button>
                }
            />
            
            <Card padding="none">
                <Table 
                    columns={columns as any} 
                    data={sessions} 
                    isLoading={loading}
                />
            </Card>

            <Modal
                isOpen={!!closingSession}
                onClose={() => setClosingSession(null)}
                title={t('pos.closeSessionTitle', 'Close Session')}
                footer={
                    <div className="pos-modal-actions">
                        <Button variant="secondary" onClick={() => setClosingSession(null)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="danger" isLoading={isClosing} onClick={handleCloseSession}>
                            {t('pos.closeSession')}
                        </Button>
                    </div>
                }
            >
                <div className="pos-modal-content">
                    <p style={{ marginBottom: '1rem' }}>
                        {t('pos.closeSessionConfirm', 'Are you sure you want to close the session for')} <b>{closingSession?.user_name}</b>?
                    </p>
                    <Input
                        label={t('pos.closingCash')}
                        type="number"
                        value={closingCash}
                        onChange={(e) => setClosingCash(e.target.value)}
                    />
                    <Input
                        label={t('pos.closingNotes')}
                        placeholder={t('pos.closingNotesPlaceholder')}
                        value={closingNotes}
                        onChange={(e) => setClosingNotes(e.target.value)}
                    />
                    <Input
                        label={t('pos.cashDifferenceReason')}
                        placeholder={t('pos.cashDifferenceReasonPlaceholder')}
                        value={closingReason}
                        onChange={(e) => setClosingReason(e.target.value)}
                    />
                    <Input
                        label={t('pos.managerUsername')}
                        placeholder={t('pos.managerUsernamePlaceholder')}
                        value={closingManagerUsername}
                        onChange={(e) => setClosingManagerUsername(e.target.value)}
                    />
                    <Input
                        label={t('pos.managerPassword')}
                        type="password"
                        value={closingManagerPassword}
                        onChange={(e) => setClosingManagerPassword(e.target.value)}
                    />
                </div>
            </Modal>
        </div>
    );
};

export default POSSessionsPage;

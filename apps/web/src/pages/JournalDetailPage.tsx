import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Modal, PageHeader, StatusBadge, useToast } from '@dms/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import JournalLinesEditor from '../components/journals/JournalLinesEditor';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { Account } from '../types/accounting';
import { JournalEntry, JournalLine } from '../types/journal';
import { useTranslation } from 'react-i18next';
import '../styles/JournalEntryPage.css';

const toIso = (value: string) => {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};

const resolveSourcePath = (entry?: JournalEntry | null) => {
    const type = entry?.source_type || '';
    if (!type) return null;
    if (type.startsWith('POS')) return '/pos';
    if (type.toLowerCase().includes('inventory')) return '/inventory/movements';
    if (type.toLowerCase().includes('settings')) return '/settings';
    return null;
};

export const JournalDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const api = useApi();
    const toast = useToast();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [lines, setLines] = useState<JournalLine[]>([]);
    const [date, setDate] = useState('');
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPostConfirm, setShowPostConfirm] = useState(false);
    const [showReverseConfirm, setShowReverseConfirm] = useState(false);

    const loadAccounts = useCallback(async () => {
        const data = await api<{ items: Account[] }>('/accounting/accounts');
        setAccounts(data.items || []);
    }, [api]);

    const loadEntry = useCallback(async () => {
        if (!id) return;
        setIsLoading(true);
        setError('');
        try {
            const data = await api<JournalEntry>(`/accounting/entries/${id}`);
            setEntry(data);
            setLines(data.lines || []);
            setDate(data.date ? data.date.slice(0, 10) : '');
            setDescription(data.description || '');
        } catch (err: any) {
            setError(err?.message || t('errors.journals.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, id, t]);

    useEffect(() => {
        loadAccounts();
        loadEntry();
    }, [loadAccounts, loadEntry]);

    const totals = useMemo(() => {
        const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
        const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
        return { debit, credit, balanced: Math.abs(debit - credit) < 0.001 };
    }, [lines]);

    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const formatDateTime = useCallback((value?: string | null) => {
        if (!value) return t('common.placeholder');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat(locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }, [locale, t]);

    const handleSave = async () => {
        if (!id) return;
        setError('');
        if (!description.trim()) {
            setError(t('errors.journals.descriptionRequired'));
            return;
        }
        if (lines.length < 2) {
            setError(t('errors.journals.minimumLines'));
            return;
        }
        if (lines.some((line) => !line.account_id)) {
            setError(t('errors.journals.accountRequired'));
            return;
        }
        setIsSaving(true);
        try {
            await api(`/accounting/entries/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    date: toIso(date),
                    description: description.trim(),
                    allowUnbalanced: true,
                    lines: lines.map((line) => ({
                        account_id: line.account_id,
                        debit: Number(line.debit || 0),
                        credit: Number(line.credit || 0),
                        description: line.description || ''
                    }))
                })
            });
            toast.success(t('toast.journals.draftUpdated'));
            loadEntry();
        } catch (err: any) {
            const message = err?.message || t('errors.journals.draftSaveFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePost = async () => {
        if (!id) return;
        setIsSaving(true);
        try {
            await api(`/accounting/entries/${id}/post`, { method: 'POST' });
            toast.success(t('toast.journals.posted'));
            setShowPostConfirm(false);
            loadEntry();
        } catch (err: any) {
            toast.error(err?.message || t('errors.journals.postFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleReverse = async () => {
        if (!id) return;
        setIsSaving(true);
        try {
            const data = await api<{ id: string }>(`/accounting/entries/${id}/reverse`, { method: 'POST' });
            toast.success(t('toast.journals.reversed'));
            setShowReverseConfirm(false);
            if (data?.id) {
                navigate(`/journals/${data.id}`);
            } else {
                loadEntry();
            }
        } catch (err: any) {
            toast.error(err?.message || t('errors.journals.reverseFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const sourcePath = resolveSourcePath(entry);

    return (
        <div className="journal-entry-page">
            <PageHeader
                title={t('nav.routes.journalsDetail.title')}
                subtitle={entry ? t('journals.detail.subtitleWithId', { id: entry.id }) : t('journals.detail.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <div className="journal-entry-page__actions">
                        {entry?.posted ? (
                            <PermissionGate perm={PERMISSIONS.ACC_REVERSE_JOURNAL} tooltip={t('errors.journals.reverseDenied')}>
                                <Button variant="secondary" onClick={() => setShowReverseConfirm(true)}>
                                    {t('journals.actions.reverse')}
                                </Button>
                            </PermissionGate>
                        ) : (
                            <>
                                <PermissionGate perm={PERMISSIONS.ACC_CREATE_JOURNAL} tooltip={t('errors.journals.saveDenied')}>
                                    <Button variant="secondary" onClick={handleSave} isLoading={isSaving}>
                                        {t('journals.actions.saveDraft')}
                                    </Button>
                                </PermissionGate>
                                <PermissionGate perm={PERMISSIONS.ACC_POST_JOURNAL} tooltip={t('errors.journals.postDenied')}>
                                    <Button variant="primary" onClick={() => setShowPostConfirm(true)} disabled={!totals.balanced}>
                                        {t('journals.actions.postEntry')}
                                    </Button>
                                </PermissionGate>
                            </>
                        )}
                    </div>
                )}
            />

            {error && <div className="journal-entry-page__error">{error}</div>}
            {isLoading && <div className="journal-entry-page__loading">{t('journals.loadingEntry')}</div>}

            {entry && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('journals.detail.statusTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="journal-entry-page__status-grid">
                            <div>
                                <div className="journal-entry-page__label">{t('common.status')}</div>
                                <StatusBadge variant={entry.posted ? 'success' : 'warning'} size="sm">
                                    {entry.posted ? t('journals.status.posted') : t('journals.status.draft')}
                                </StatusBadge>
                            </div>
                            <div>
                                <div className="journal-entry-page__label">{t('journals.detail.postedAt')}</div>
                                <div className="journal-entry-page__value">{formatDateTime(entry.posted_at)}</div>
                            </div>
                            <div>
                                <div className="journal-entry-page__label">{t('journals.detail.balanced')}</div>
                                <StatusBadge variant={totals.balanced ? 'success' : 'warning'} size="sm">
                                    {totals.balanced ? t('common.yes') : t('common.no')}
                                </StatusBadge>
                            </div>
                            {entry.source_type && (
                                <div>
                                    <div className="journal-entry-page__label">{t('journals.detail.source')}</div>
                                    <div className="journal-entry-page__value">
                                        {t('journals.table.source', { type: entry.source_type, id: entry.source_id })}
                                    </div>
                                    {sourcePath && (
                                        <Button variant="ghost" size="sm" onClick={() => navigate(sourcePath)}>
                                            {t('journals.detail.openSource')}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>{t('journals.entry.detailsTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="journal-entry-page__form">
                        <Input
                            label={t('journals.entry.postingDate')}
                            type="date"
                            value={date}
                            onChange={(event) => setDate(event.target.value)}
                            disabled={Boolean(entry?.posted)}
                        />
                        <Input
                            label={t('journals.entry.description')}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            disabled={Boolean(entry?.posted)}
                        />
                        <div className="journal-entry-page__totals">
                            <span>{t('journals.entry.totalDebit', { value: totals.debit.toFixed(2) })}</span>
                            <span>{t('journals.entry.totalCredit', { value: totals.credit.toFixed(2) })}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('journals.entry.linesTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <JournalLinesEditor
                        accounts={accounts}
                        lines={lines}
                        onChange={setLines}
                        disabled={Boolean(entry?.posted)}
                    />
                </CardContent>
            </Card>

            <Modal
                isOpen={showPostConfirm}
                onClose={() => setShowPostConfirm(false)}
                title={t('journals.modals.postTitle')}
                footer={(
                    <div className="journal-entry-page__modal-footer">
                        <Button variant="secondary" onClick={() => setShowPostConfirm(false)}>{t('common.cancel')}</Button>
                        <Button variant="primary" onClick={handlePost} isLoading={isSaving} disabled={!totals.balanced}>
                            {t('journals.modals.confirmPost')}
                        </Button>
                    </div>
                )}
            >
                <div className="journal-entry-page__modal-body">
                    {t('journals.modals.postBody')}
                </div>
            </Modal>

            <Modal
                isOpen={showReverseConfirm}
                onClose={() => setShowReverseConfirm(false)}
                title={t('journals.modals.reverseTitle')}
                footer={(
                    <div className="journal-entry-page__modal-footer">
                        <Button variant="secondary" onClick={() => setShowReverseConfirm(false)}>{t('common.cancel')}</Button>
                        <Button variant="primary" onClick={handleReverse} isLoading={isSaving}>
                            {t('journals.modals.confirmReverse')}
                        </Button>
                    </div>
                )}
            >
                <div className="journal-entry-page__modal-body">
                    {t('journals.modals.reverseBody')}
                </div>
            </Modal>
        </div>
    );
};

export default JournalDetailPage;

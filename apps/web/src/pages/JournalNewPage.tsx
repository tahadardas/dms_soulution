import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, StatusBadge, useToast } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import JournalLinesEditor from '../components/journals/JournalLinesEditor';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { Account } from '../types/accounting';
import { JournalLine } from '../types/journal';
import { useTranslation } from 'react-i18next';
import '../styles/JournalEntryPage.css';

const toIso = (value: string) => {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
};

const createInitialLines = (): JournalLine[] => ([
    { account_id: 0, debit: 0, credit: 0, description: '' },
    { account_id: 0, debit: 0, credit: 0, description: '' }
]);

export const JournalNewPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [lines, setLines] = useState<JournalLine[]>(createInitialLines());
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [description, setDescription] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const loadAccounts = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await api<{ items: Account[] }>('/accounting/accounts');
            setAccounts(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.journals.accountsLoadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, t]);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const totals = useMemo(() => {
        const debit = lines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
        const credit = lines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
        return { debit, credit, balanced: Math.abs(debit - credit) < 0.001 };
    }, [lines]);

    const handleSave = async () => {
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
            const payload = {
                date: toIso(date),
                description: description.trim(),
                source_type: 'MANUAL',
                source_id: null,
                allowUnbalanced: true,
                lines: lines.map((line) => ({
                    account_id: line.account_id,
                    debit: Number(line.debit || 0),
                    credit: Number(line.credit || 0),
                    description: line.description || ''
                }))
            };
            const data = await api<{ id: string }>('/accounting/entries', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            toast.success(t('toast.journals.draftSaved'));
            if (data?.id) {
                navigate(`/journals/${data.id}`);
            }
        } catch (err: any) {
            const message = err?.message || t('errors.journals.draftSaveFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="journal-entry-page">
            <PageHeader
                title={t('nav.routes.journalsNew.title')}
                subtitle={t('nav.routes.journalsNew.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.ACC_CREATE_JOURNAL}
                        tooltip={t('errors.journals.createDenied')}
                    >
                        <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                            {t('journals.actions.saveDraft')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="journal-entry-page__error">{error}</div>}
            {isLoading && <div className="journal-entry-page__loading">{t('journals.loadingAccounts')}</div>}

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
                        />
                        <Input
                            label={t('journals.entry.description')}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder={t('journals.entry.descriptionPlaceholder')}
                        />
                        <div className="journal-entry-page__status">
                            <StatusBadge variant={totals.balanced ? 'success' : 'warning'} size="sm">
                                {totals.balanced ? t('journals.entry.balanced') : t('journals.entry.unbalanced')}
                            </StatusBadge>
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
                    <JournalLinesEditor accounts={accounts} lines={lines} onChange={setLines} />
                </CardContent>
            </Card>
        </div>
    );
};

export default JournalNewPage;

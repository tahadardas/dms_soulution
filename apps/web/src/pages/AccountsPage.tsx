import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Column, Input, Modal, PageHeader, Select, StatusBadge, Table, useToast } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { PERMISSIONS } from '../lib/permissions';
import { Account } from '../types/accounting';
import { useTranslation } from 'react-i18next';
import '../styles/AccountsPage.css';

const TYPE_OPTIONS: Account['type'][] = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

const typeVariantMap: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'neutral'> = {
    ASSET: 'info',
    LIABILITY: 'warning',
    EQUITY: 'neutral',
    REVENUE: 'success',
    EXPENSE: 'danger'
};

type AccountForm = {
    id?: number;
    code: string;
    name: string;
    type: Account['type'];
    parent_id: string;
    is_active: boolean;
};

const DEFAULT_FORM: AccountForm = {
    code: '',
    name: '',
    type: 'ASSET',
    parent_id: '',
    is_active: true
};

export const AccountsPage: React.FC = () => {
    const api = useApi();
    const toast = useToast();
    const { t } = useTranslation();
    const typeLabels = useMemo(() => ({
        ASSET: t('accounts.types.asset'),
        LIABILITY: t('accounts.types.liability'),
        EQUITY: t('accounts.types.equity'),
        REVENUE: t('accounts.types.revenue'),
        EXPENSE: t('accounts.types.expense')
    }), [t]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [form, setForm] = useState<AccountForm>(DEFAULT_FORM);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            const trimmed = search.trim();
            setDebouncedSearch(trimmed.length >= 2 ? trimmed : '');
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    const loadAccounts = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (debouncedSearch) params.set('search', debouncedSearch);
            const data = await api<{ items: Account[] }>(`/accounting/accounts?${params.toString()}`);
            setAccounts(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.accounts.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, debouncedSearch, t]);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const openCreate = () => {
        setForm(DEFAULT_FORM);
        setIsModalOpen(true);
    };

    const openEdit = (account: Account) => {
        setForm({
            id: account.id,
            code: account.code,
            name: account.name,
            type: account.type,
            parent_id: account.parent_id ? String(account.parent_id) : '',
            is_active: (account.is_active ?? 1) === 1
        });
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error(t('errors.accounts.missingFields'));
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                code: form.code.trim(),
                name: form.name.trim(),
                type: form.type,
                parent_id: form.parent_id ? Number(form.parent_id) : null,
                is_active: form.is_active ? 1 : 0
            };
            if (form.id) {
                await api(`/accounting/accounts/${form.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                toast.success(t('toast.accounts.updated'));
            } else {
                await api('/accounting/accounts', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                toast.success(t('toast.accounts.created'));
            }
            setIsModalOpen(false);
            loadAccounts();
        } catch (err: any) {
            toast.error(err?.message || t('errors.accounts.saveFailed'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (account: Account) => {
        if (!account.id) return;
        if (!window.confirm(t('accounts.deleteConfirm', { code: account.code }))) return;
        try {
            await api(`/accounting/accounts/${account.id}`, { method: 'DELETE' });
            toast.success(t('toast.accounts.deleted'));
            loadAccounts();
        } catch (err: any) {
            toast.error(err?.message || t('errors.accounts.deleteFailed'));
        }
    };

    const rows = useMemo(() => {
        if (debouncedSearch) return accounts;
        const map = new Map<number, Account[]>();
        accounts.forEach((acc) => {
            const parentId = acc.parent_id || 0;
            if (!map.has(parentId)) map.set(parentId, []);
            map.get(parentId)!.push(acc);
        });
        const output: Array<Account & { level: number }> = [];
        const walk = (parentId: number, level: number) => {
            const children = map.get(parentId) || [];
            children.sort((a, b) => a.code.localeCompare(b.code));
            children.forEach((child) => {
                output.push({ ...child, level });
                walk(child.id, level + 1);
            });
        };
        walk(0, 0);
        return output;
    }, [accounts, debouncedSearch]);

    const columns: Column<Account>[] = useMemo(
        () => [
            {
                header: t('accounts.table.account'),
                accessorKey: 'name',
                cell: (row: Account & { level?: number }) => (
                    <div className={`accounts-table__name accounts-table__name--level-${Math.min(row.level || 0, 6)}`}>
                        <div className="accounts-table__code">{row.code}</div>
                        <div className="accounts-table__label">{row.name}</div>
                    </div>
                )
            },
            {
                header: t('common.type'),
                accessorKey: 'type',
                cell: (row: Account) => (
                    <StatusBadge variant={typeVariantMap[row.type] || 'neutral'} size="sm">
                        {typeLabels[row.type as keyof typeof typeLabels] || row.type}
                    </StatusBadge>
                )
            },
            {
                header: t('common.status'),
                accessorKey: 'is_active',
                cell: (row: Account) => (
                    <StatusBadge variant={(row.is_active ?? 1) === 1 ? 'success' : 'neutral'} size="sm">
                        {(row.is_active ?? 1) === 1 ? t('common.active') : t('common.inactive')}
                    </StatusBadge>
                )
            },
            {
                header: t('common.actions'),
                accessorKey: 'actions' as keyof Account,
                cell: (row: Account) => (
                    <div className="accounts-table__actions">
                        <PermissionGate perm={PERMISSIONS.ACC_EDIT_COA} tooltip={t('errors.accounts.editDenied')}>
                            <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
                                {t('common.edit')}
                            </Button>
                        </PermissionGate>
                        {row.is_system ? (
                            <Button size="sm" variant="ghost" disabled>
                                {t('accounts.system')}
                            </Button>
                        ) : (
                            <PermissionGate perm={PERMISSIONS.ACC_EDIT_COA} tooltip={t('errors.accounts.deleteDenied')}>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(row)}>
                                    {t('common.delete')}
                                </Button>
                            </PermissionGate>
                        )}
                    </div>
                )
            }
        ],
        [t, typeLabels]
    );

    const parentOptions = useMemo(
        () => accounts
            .filter((acc) => !form.id || acc.id !== form.id)
            .map((acc) => ({ id: String(acc.id), label: `${acc.code} ${acc.name}` })),
        [accounts, form.id]
    );

    return (
        <div className="accounts-page">
            <PageHeader
                title={t('accounts.title')}
                subtitle={t('accounts.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate
                        perm={PERMISSIONS.ACC_EDIT_COA}
                        tooltip={t('errors.accounts.createDenied')}
                    >
                        <Button variant="primary" onClick={openCreate}>{t('accounts.actions.newAccount')}</Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="accounts-page__error">{error}</div>}
            {isLoading && <div className="accounts-page__loading">{t('accounts.loading')}</div>}

            <Card>
                <CardHeader>
                    <CardTitle>{t('common.search')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Input
                        label={t('accounts.searchLabel')}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('accounts.searchPlaceholder')}
                    />
                    {search.trim().length > 0 && search.trim().length < 2 && (
                        <div className="accounts-page__hint">{t('common.searchMinHint')}</div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('accounts.listTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table data={rows} columns={columns} isLoading={isLoading} />
                    {!isLoading && rows.length === 0 && (
                        <div className="accounts-page__empty">{t('accounts.empty')}</div>
                    )}
                </CardContent>
            </Card>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={form.id ? t('accounts.editTitle') : t('accounts.newTitle')}
                footer={(
                    <div className="accounts-modal__footer">
                        <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
                        <PermissionGate perm={PERMISSIONS.ACC_EDIT_COA} tooltip={t('errors.accounts.saveDenied')}>
                            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                                {t('common.save')}
                            </Button>
                        </PermissionGate>
                    </div>
                )}
            >
                <div className="accounts-modal">
                    <Input
                        label={t('accounts.fields.code')}
                        value={form.code}
                        onChange={(event) => setForm(prev => ({ ...prev, code: event.target.value }))}
                    />
                    <Input
                        label={t('accounts.fields.name')}
                        value={form.name}
                        onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))}
                    />
                    <Select
                        label={t('accounts.fields.type')}
                        value={form.type}
                        onChange={(event) => setForm(prev => ({ ...prev, type: event.target.value as Account['type'] }))}
                    >
                        {TYPE_OPTIONS.map((type) => (
                            <option key={type} value={type}>{typeLabels[type as keyof typeof typeLabels] || type}</option>
                        ))}
                    </Select>
                    <Select
                        label={t('accounts.fields.parent')}
                        value={form.parent_id}
                        onChange={(event) => setForm(prev => ({ ...prev, parent_id: event.target.value }))}
                    >
                        <option value="">{t('accounts.noParent')}</option>
                        {parentOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                        ))}
                    </Select>
                    <Select
                        label={t('accounts.fields.status')}
                        value={form.is_active ? 'active' : 'inactive'}
                        onChange={(event) => setForm(prev => ({ ...prev, is_active: event.target.value === 'active' }))}
                    >
                        <option value="active">{t('common.active')}</option>
                        <option value="inactive">{t('common.inactive')}</option>
                    </Select>
                </div>
            </Modal>
        </div>
    );
};

export default AccountsPage;

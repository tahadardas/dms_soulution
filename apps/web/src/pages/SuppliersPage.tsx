import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Table, StatusBadge, Column, Input } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { PERMISSIONS } from '../lib/permissions';
import { Supplier } from '../types/invoices';

export const SuppliersPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const loadSuppliers = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api<{ items: Supplier[] }>('/suppliers');
            setSuppliers(data.items || []);
        } catch (err: any) {
            setError(err?.message || 'Failed to load suppliers');
        } finally {
            setIsLoading(false);
        }
    }, [api]);

    useEffect(() => {
        loadSuppliers();
    }, [loadSuppliers]);

    const filteredSuppliers = useMemo(() => {
        return suppliers.filter(s => 
            s.name.toLowerCase().includes(search.toLowerCase()) || 
            s.phone?.includes(search) ||
            s.payable_account_code?.includes(search)
        );
    }, [suppliers, search]);

    const columns: Column<Supplier>[] = [
        {
            header: t('suppliers.fields.name'),
            accessorKey: 'name',
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-gray-500">{row.phone || row.email || '-'}</div>
                </div>
            )
        },
        {
            header: t('suppliers.fields.payableAccount'),
            accessorKey: 'payable_account_code',
            cell: (row) => (
                <div>
                    <code className="text-xs bg-gray-100 px-1 rounded">{row.payable_account_code}</code>
                    <div className="text-[10px] text-gray-400">{row.payable_account_name}</div>
                </div>
            )
        },
        {
            header: t('common.status'),
            accessorKey: 'is_active',
            cell: (row) => (
                <StatusBadge variant={row.is_active === 1 ? 'success' : 'neutral'}>
                    {row.is_active === 1 ? t('common.active') : t('common.inactive')}
                </StatusBadge>
            )
        },
        {
            header: t('common.actions'),
            cell: (row) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/suppliers/payment?supplierId=${row.id}`); }}>
                        {t('suppliers.actions.recordPayment')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/ledger?accountId=${row.payable_account_id}`); }}>
                        {t('suppliers.actions.viewStatement')}
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="suppliers-page">
            <PageHeader
                title={t('suppliers.title')}
                subtitle={t('suppliers.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate perm={PERMISSIONS.INV_PURCHASE}>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => navigate('/suppliers/payment')}>
                                {t('suppliers.actions.recordPayment')}
                            </Button>
                            <Button variant="primary" onClick={() => navigate('/suppliers/new')}>
                                {t('suppliers.actions.newSupplier')}
                            </Button>
                        </div>
                    </PermissionGate>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('suppliers.stats.totalSuppliers')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{suppliers.length}</div>
                    </CardContent>
                </Card>
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>{t('common.search')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Input 
                            placeholder={t('common.searchPlaceholder')} 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </CardContent>
                </Card>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-md mb-4">{error}</div>}

            <Card>
                <CardContent>
                    <Table 
                        data={filteredSuppliers} 
                        columns={columns} 
                        isLoading={isLoading} 
                        onRowClick={(row) => navigate(`/suppliers/${row.id}`)}
                    />
                    {!isLoading && filteredSuppliers.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            <div className="text-lg font-medium text-gray-600">{t('suppliers.empty.title')}</div>
                            <p>{t('suppliers.empty.description')}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SuppliersPage;

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Table, StatusBadge, Column, Input } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { PERMISSIONS } from '../lib/permissions';

export interface Customer {
    id: number;
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    tax_number?: string;
    receivable_account_id?: number;
    receivable_account_code?: string;
    receivable_account_name?: string;
    advance_account_id?: number;
    opening_balance?: number;
    currency_code?: string;
    is_active: number;
}

export const CustomersPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    const loadCustomers = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api<{ items: Customer[] }>('/customers');
            setCustomers(data.items || []);
        } catch (err: any) {
            setError(err?.message || 'Failed to load customers');
        } finally {
            setIsLoading(false);
        }
    }, [api]);

    useEffect(() => {
        loadCustomers();
    }, [loadCustomers]);

    const filteredCustomers = useMemo(() => {
        return customers.filter(c => 
            c.name.toLowerCase().includes(search.toLowerCase()) || 
            c.phone?.includes(search) ||
            c.receivable_account_code?.includes(search)
        );
    }, [customers, search]);

    const columns: Column<Customer>[] = [
        {
            header: t('customers.fields.name'),
            accessorKey: 'name',
            cell: (row) => (
                <div>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-xs text-gray-500">{row.phone || row.email || '-'}</div>
                </div>
            )
        },
        {
            header: t('customers.fields.receivableAccount'),
            accessorKey: 'receivable_account_code',
            cell: (row) => (
                <div>
                    <code className="text-xs bg-gray-100 px-1 rounded">{row.receivable_account_code}</code>
                    <div className="text-[10px] text-gray-400">{row.receivable_account_name}</div>
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
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/customers/receipt?customerId=${row.id}`); }}>
                        {t('customers.actions.recordReceipt')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/ledger?accountId=${row.receivable_account_id}`); }}>
                        {t('customers.actions.viewStatement')}
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="customers-page">
            <PageHeader
                title={t('customers.title')}
                subtitle={t('customers.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate perm={PERMISSIONS.INV_SALES_INV}>
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => navigate('/customers/receipt')}>
                                {t('customers.actions.recordReceipt')}
                            </Button>
                            <Button variant="primary" onClick={() => navigate('/customers/new')}>
                                {t('customers.actions.newCustomer')}
                            </Button>
                        </div>
                    </PermissionGate>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('customers.stats.totalCustomers')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{customers.length}</div>
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
                        data={filteredCustomers} 
                        columns={columns} 
                        isLoading={isLoading} 
                        onRowClick={(row) => navigate(`/customers/${row.id}`)}
                    />
                    {!isLoading && filteredCustomers.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            <div className="text-lg font-medium text-gray-600">{t('customers.empty.title')}</div>
                            <p>{t('customers.empty.description')}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default CustomersPage;

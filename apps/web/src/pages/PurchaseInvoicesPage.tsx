import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Table, StatusBadge, Column } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { PurchaseInvoice } from '../types/invoices';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { PERMISSIONS } from '../lib/permissions';

export const PurchaseInvoicesPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const loadInvoices = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api<{ items: PurchaseInvoice[] }>('/purchase-invoices');
            setInvoices(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.invoices.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, t]);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    const columns: Column<PurchaseInvoice>[] = [
        {
            header: t('invoices.table.number'),
            accessorKey: 'invoice_number'
        },
        {
            header: t('invoices.table.date'),
            accessorKey: 'date'
        },
        {
            header: t('invoices.table.supplier'),
            accessorKey: 'supplier_name'
        },
        {
            header: t('invoices.table.amount'),
            accessorKey: 'total_amount',
            cell: (row) => row.total_amount.toLocaleString()
        },
        {
            header: t('common.status'),
            accessorKey: 'status',
            cell: (row) => (
                <StatusBadge 
                    variant={row.status === 'POSTED' ? 'success' : row.status === 'DRAFT' ? 'warning' : 'danger'}
                >
                    {t(`invoices.status.${row.status.toLowerCase()}`)}
                </StatusBadge>
            )
        },
        {
            header: t('common.actions'),
            cell: (row) => (
                <Button variant="ghost" size="sm" onClick={() => navigate(`/purchase-invoices/${row.id}`)}>
                    {t('common.view')}
                </Button>
            )
        }
    ];

    return (
        <div className="purchase-invoices-page">
            <PageHeader
                title={t('nav.routes.purchaseInvoices.title')}
                subtitle={t('nav.routes.purchaseInvoices.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <PermissionGate perm={PERMISSIONS.INV_PURCHASE}>
                        <Button variant="primary" onClick={() => navigate('/purchase-invoices/new')}>
                            {t('invoices.actions.newPurchase')}
                        </Button>
                    </PermissionGate>
                )}
            />

            {error && <div className="standard-page__error">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('invoices.stats.totalPurchases')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {invoices.reduce((sum, inv) => sum + (inv.status === 'POSTED' ? inv.total_amount : 0), 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>{t('invoices.stats.pendingInvoices')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {invoices.filter(inv => inv.status === 'DRAFT').length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent>
                    <Table 
                        data={invoices} 
                        columns={columns} 
                        isLoading={isLoading} 
                        onRowClick={(row) => navigate(`/purchase-invoices/${row.id}`)}
                    />
                </CardContent>
            </Card>
        </div>
    );
};

export default PurchaseInvoicesPage;

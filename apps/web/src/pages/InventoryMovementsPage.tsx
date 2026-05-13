import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, DateRangePicker, PageHeader, Select, StatusBadge, Table, Column } from '@dms/ui';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import { Branch, InventoryMovement } from '../types/inventory';
import { useTranslation } from 'react-i18next';
import '../styles/InventoryMovementsPage.css';

const TYPE_OPTIONS = [
    'IN',
    'OUT',
    'ADJUST',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'SALE',
    'RETURN'
];

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

export const InventoryMovementsPage: React.FC = () => {
    const api = useApi();
    const { t, i18n } = useTranslation();
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [typeFilter, setTypeFilter] = useState('');
    const [branchId, setBranchId] = useState('');
    const [range, setRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        return {
            startDate: start.toISOString().slice(0, 10),
            endDate: now.toISOString().slice(0, 10)
        };
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const loadBranches = useCallback(async () => {
        try {
            const data = await api<{ items: Branch[] }>('/branches');
            setBranches(data.items || []);
        } catch {
            setBranches([]);
        }
    }, [api]);

    const loadMovements = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            params.set('startDate', toRangeIso(range.startDate, false));
            params.set('endDate', toRangeIso(range.endDate, true));
            if (typeFilter) params.set('type', typeFilter);
            if (branchId) params.set('branchId', branchId);
            const data = await api<{ items: InventoryMovement[] }>(`/inventory/movements?${params.toString()}`);
            setMovements(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.inventory.movementsLoadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, branchId, range, typeFilter]);

    useEffect(() => {
        loadBranches();
    }, [loadBranches]);

    useEffect(() => {
        loadMovements();
    }, [loadMovements]);

    const summary = useMemo(() => {
        const inboundTypes = new Set(['IN', 'RETURN', 'TRANSFER_IN']);
        const outboundTypes = new Set(['OUT', 'SALE', 'TRANSFER_OUT']);
        let inbound = 0;
        let outbound = 0;
        movements.forEach((movement) => {
            if (inboundTypes.has(movement.type)) inbound += Math.abs(movement.quantity);
            if (outboundTypes.has(movement.type)) outbound += Math.abs(movement.quantity);
        });
        return { inbound, outbound };
    }, [movements]);

    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const formatDateTime = useCallback((value: string) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat(locale, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(date);
    }, [locale]);

    const columns: Column<InventoryMovement>[] = useMemo(
        () => [
            {
                header: t('inventory.movements.table.date'),
                accessorKey: 'date',
                cell: (row: InventoryMovement) => formatDateTime(row.date)
            },
            {
                header: t('inventory.movements.table.item'),
                accessorKey: 'product_name',
                cell: (row: InventoryMovement) => row.product_name || t('inventory.movements.table.itemFallback', { id: row.product_id })
            },
            {
                header: t('inventory.movements.table.type'),
                accessorKey: 'type',
                cell: (row: InventoryMovement) => (
                    <StatusBadge variant={row.type.includes('OUT') || row.type === 'SALE' ? 'danger' : 'success'} size="sm">
                        {row.type}
                    </StatusBadge>
                )
            },
            {
                header: t('inventory.movements.table.quantity'),
                accessorKey: 'quantity',
                cell: (row: InventoryMovement) => row.quantity
            },
            {
                header: t('inventory.movements.table.branch'),
                accessorKey: 'branch_name',
                cell: (row: InventoryMovement) => row.branch_name || t('common.placeholder')
            },
            {
                header: t('inventory.movements.table.reason'),
                accessorKey: 'reason',
                cell: (row: InventoryMovement) => row.reason || row.description || t('common.placeholder')
            }
        ],
        [formatDateTime, t]
    );

    return (
        <div className="inventory-movements-page">
            <PageHeader
                title={t('inventory.movements.title')}
                subtitle={t('inventory.movements.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <div className="inventory-movements-page__actions">
                        <DateRangePicker
                            value={range}
                            onChange={setRange}
                            startLabel={t('common.startDate')}
                            endLabel={t('common.endDate')}
                            separatorLabel={t('common.to')}
                        />
                    </div>
                )}
            />

            {error && <div className="inventory-movements-page__error">{error}</div>}
            {isLoading && <div className="inventory-movements-page__loading">{t('inventory.movements.loading')}</div>}

            <div className="inventory-movements-page__filters">
                <Select
                    label={t('inventory.movements.filters.type')}
                    value={typeFilter}
                    onChange={(event) => setTypeFilter(event.target.value)}
                >
                    <option value="">{t('inventory.movements.filters.allTypes')}</option>
                    {TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </Select>
                <Select
                    label={t('inventory.movements.filters.branch')}
                    value={branchId}
                    onChange={(event) => setBranchId(event.target.value)}
                >
                    <option value="">{t('inventory.movements.filters.allBranches')}</option>
                    {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                </Select>
            </div>

            <div className="inventory-movements-page__summary">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('inventory.movements.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="inventory-movements-page__summary-grid">
                            <div>
                                <div className="inventory-movements-page__summary-label">{t('inventory.movements.summary.total')}</div>
                                <div className="inventory-movements-page__summary-value">{movements.length}</div>
                            </div>
                            <div>
                                <div className="inventory-movements-page__summary-label">{t('inventory.movements.summary.inbound')}</div>
                                <div className="inventory-movements-page__summary-value">{summary.inbound}</div>
                            </div>
                            <div>
                                <div className="inventory-movements-page__summary-label">{t('inventory.movements.summary.outbound')}</div>
                                <div className="inventory-movements-page__summary-value">{summary.outbound}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('inventory.movements.table.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table data={movements} columns={columns} isLoading={isLoading} />
                    {!isLoading && !error && movements.length === 0 && (
                        <div className="inventory-movements-page__empty">
                            {t('inventory.movements.empty')}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default InventoryMovementsPage;

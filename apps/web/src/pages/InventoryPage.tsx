import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, Select, StatusBadge, Table, Column } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { useCan } from '../hooks/useCan';
import { PERMISSIONS } from '../lib/permissions';
import { Category } from '../types/products';
import { Branch, InventoryAlert, InventoryItem } from '../types/inventory';
import { useTranslation } from 'react-i18next';
import '../styles/InventoryPage.css';

const PAGE_SIZE = 20;

export const InventoryPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const canViewCategories = useCan(PERMISSIONS.PRD_VIEW);
    const { t } = useTranslation();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const handler = setTimeout(() => {
            const trimmed = search.trim();
            setDebouncedSearch(trimmed.length >= 2 ? trimmed : '');
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        setPage((prev) => (prev === 1 ? prev : 1));
    }, [debouncedSearch, categoryId, branchId, statusFilter]);

    const loadFilters = useCallback(async () => {
        try {
            const [branchesData, categoriesData] = await Promise.all([
                api<{ items: Branch[] }>('/branches'),
                canViewCategories ? api<{ items: Category[] }>('/inventory/categories') : Promise.resolve({ items: [] })
            ]);
            setBranches(branchesData.items || []);
            setCategories(categoriesData.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.inventory.loadFiltersFailed'));
        }
    }, [api, canViewCategories, t]);

    const loadItems = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (debouncedSearch) params.set('search', debouncedSearch);
            if (categoryId) params.set('categoryId', categoryId);
            if (branchId) params.set('branchId', branchId);
            if (statusFilter !== 'all') params.set('isActive', statusFilter === 'active' ? 'true' : 'false');
            params.set('page', String(page));
            params.set('pageSize', String(PAGE_SIZE));

            const data = await api<{ items: InventoryItem[]; total: number }>(`/inventory/items?${params.toString()}`);
            setItems(data.items || []);
            setTotal(data.total || 0);
        } catch (err: any) {
            setError(err?.message || t('errors.inventory.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, branchId, categoryId, debouncedSearch, page, statusFilter, t]);

    const loadAlerts = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (branchId) params.set('branchId', branchId);
            const data = await api<{ items: InventoryAlert[] }>(`/inventory/alerts/low-stock?${params.toString()}`);
            setAlerts(data.items || []);
        } catch {
            setAlerts([]);
        }
    }, [api, branchId]);

    useEffect(() => {
        loadFilters();
    }, [loadFilters]);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    useEffect(() => {
        loadAlerts();
    }, [loadAlerts]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const categoryOptions = useMemo(() => {
        return categories.map((category) => ({
            id: String(category.id),
            label: `${category.name}${category.is_active === 0 ? ` (${t('common.inactive')})` : ''}`
        }));
    }, [categories, t]);

    const columns: Column<InventoryItem>[] = useMemo(
        () => [
            {
                header: t('inventory.table.item'),
                accessorKey: 'name',
                cell: (row: InventoryItem) => (
                    <div className="inventory-table__title">
                        <div className="inventory-table__name">{row.name}</div>
                        <div className="inventory-table__sku">{t('inventory.table.sku', { sku: row.sku })}</div>
                    </div>
                )
            },
            {
                header: t('inventory.table.category'),
                accessorKey: 'category_name',
                cell: (row: InventoryItem) => row.category_name || t('inventory.table.uncategorized')
            },
            {
                header: t('inventory.table.onHand'),
                accessorKey: 'on_hand',
                cell: (row: InventoryItem) => row.on_hand ?? 0
            },
            {
                header: t('inventory.table.unit'),
                accessorKey: 'unit_name',
                cell: (row: InventoryItem) => row.unit_name ? `${row.unit_name} (${row.unit_abbr || '-'})` : t('common.placeholder')
            },
            {
                header: t('inventory.table.min'),
                accessorKey: 'min_stock_level',
                cell: (row: InventoryItem) => row.min_stock_level ?? t('common.placeholder')
            },
            {
                header: t('common.status'),
                cell: (row: InventoryItem) => {
                    const threshold = row.min_stock_level ?? null;
                    const isLow = threshold !== null && row.on_hand <= threshold;
                    return (
                        <StatusBadge variant={isLow ? 'warning' : 'success'} size="sm">
                            {isLow ? t('inventory.table.low') : t('inventory.table.ok')}
                        </StatusBadge>
                    );
                }
            }
        ],
        [t]
    );

    const alertColumns: Column<any>[] = useMemo(() => [
        {
            header: t('common.actions'),
            accessorKey: 'actions',
            cell: (_row: any) => (
                <Button variant="ghost" size="sm" onClick={() => navigate('/inventory/items')}>
                    {t('inventory.actions.viewStock')}
                </Button>
            )
        },
        {
            header: t('inventory.table.severity'),
            accessorKey: 'severity',
            cell: (row: any) => (
                <StatusBadge variant={row.severity === 'HIGH' ? 'danger' : 'warning'} size="sm">
                    {t(`inventory.severity.${(row.severity || 'LOW').toLowerCase()}`)}
                </StatusBadge>
            )
        },
        { header: t('inventory.alerts.item'), accessorKey: 'name' },
        { header: t('inventory.alerts.onHand'), accessorKey: 'on_hand' },
        { header: t('inventory.alerts.min'), accessorKey: 'threshold' },
        {
            header: t('inventory.table.branch'),
            accessorKey: 'branch_name',
            cell: (row: any) => row.branch_name || '-'
        }
    ], [navigate, t]);

    return (
        <div className="inventory-page">
            <PageHeader
                title={t('inventory.title')}
                subtitle={t('inventory.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <div className="inventory-page__actions">
                        <PermissionGate
                            perm={PERMISSIONS.INV_ADJUST}
                            tooltip={t('errors.inventory.adjustDenied')}
                        >
                            <Button variant="primary" onClick={() => navigate('/inventory/adjust')}>
                                {t('inventory.actions.newAdjustment')}
                            </Button>
                        </PermissionGate>
                        <PermissionGate
                            perm={PERMISSIONS.INV_TRANSFER}
                            tooltip={t('errors.inventory.transferDenied')}
                        >
                            <Button variant="secondary" onClick={() => navigate('/inventory/transfers')}>
                                {t('inventory.actions.newTransfer')}
                            </Button>
                        </PermissionGate>
                    </div>
                )}
            />

            {error && <div className="inventory-page__error">{error}</div>}
            {isLoading && <div className="inventory-page__loading">{t('inventory.loading')}</div>}

            <div className="inventory-page__grid">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('common.filters')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="inventory-page__filters">
                            <Input
                                label={t('common.search')}
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t('inventory.searchPlaceholder')}
                            />
                            {canViewCategories && (
                                <Select
                                    label={t('inventory.filters.category')}
                                    value={categoryId}
                                    onChange={(event) => setCategoryId(event.target.value)}
                                >
                                    <option value="">{t('inventory.filters.allCategories')}</option>
                                    {categoryOptions.map((category) => (
                                        <option key={category.id} value={category.id}>{category.label}</option>
                                    ))}
                                </Select>
                            )}
                            <Select
                                label={t('inventory.filters.branch')}
                                value={branchId}
                                onChange={(event) => setBranchId(event.target.value)}
                            >
                                <option value="">{t('inventory.filters.allBranches')}</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                                ))}
                            </Select>
                            <Select
                                label={t('common.status')}
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                            >
                                <option value="all">{t('common.all')}</option>
                                <option value="active">{t('common.active')}</option>
                                <option value="inactive">{t('common.inactive')}</option>
                            </Select>
                        </div>
                        {search.trim().length > 0 && search.trim().length < 2 && (
                            <div className="inventory-page__search-hint">
                                {t('common.searchMinHint')}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('inventory.snapshotTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="inventory-page__summary">
                            <div className="inventory-page__summary-item">
                                <span className="inventory-page__summary-label">{t('inventory.summary.items')}</span>
                                <span className="inventory-page__summary-value">{total}</span>
                                <span className="inventory-page__summary-hint">{t('inventory.summary.itemsHint')}</span>
                            </div>
                            <div className="inventory-page__summary-item">
                                <span className="inventory-page__summary-label">{t('inventory.summary.lowStock')}</span>
                                <span className="inventory-page__summary-value">{alerts.length}</span>
                                <span className="inventory-page__summary-hint">{t('inventory.summary.lowStockHint')}</span>
                            </div>
                            <div className="inventory-page__summary-item">
                                <span className="inventory-page__summary-label">{t('common.page')}</span>
                                <span className="inventory-page__summary-value">{page} / {totalPages}</span>
                                <span className="inventory-page__summary-hint">{t('inventory.summary.pageHint')}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="inventory-page__table-header">
                    <CardTitle>{t('inventory.table.title')}</CardTitle>
                    <div className="inventory-page__pagination">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1}
                        >
                            {t('common.previous')}
                        </Button>
                        <span className="inventory-page__pagination-text">
                            {t('common.pageOf', { page, totalPages })}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={page >= totalPages}
                        >
                            {t('common.next')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table
                        data={items}
                        columns={columns}
                        isLoading={isLoading}
                        onRowClick={canViewCategories ? (row) => row.id && navigate(`/products/${row.id}`) : undefined}
                    />
                    {!isLoading && !error && items.length === 0 && (
                        <div className="inventory-page__empty">
                            <div className="inventory-page__empty-title">{t('inventory.empty.title')}</div>
                            <div className="inventory-page__empty-description">
                                {t('inventory.empty.description')}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('inventory.alerts.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {alerts.length === 0 ? (
                        <div className="inventory-page__empty">
                            <div className="inventory-page__empty-title">{t('inventory.alerts.emptyTitle')}</div>
                            <div className="inventory-page__empty-description">
                                {t('inventory.alerts.emptyDescription')}
                            </div>
                        </div>
                    ) : (
                        <Table data={alerts} columns={alertColumns} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default InventoryPage;

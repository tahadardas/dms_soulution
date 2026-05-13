import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, Select, StatusBadge, Table, Column } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import CategoryManager from '../components/products/CategoryManager';
import UnitManager from '../components/products/UnitManager';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { useCurrencyFormatter } from '../hooks/useCurrencyFormatter';
import { PERMISSIONS } from '../lib/permissions';
import { Category, Product } from '../types/products';
import { useTranslation } from 'react-i18next';
import '../styles/ProductsPage.css';

const PAGE_SIZE = 20;

export const ProductsPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [isUnitOpen, setIsUnitOpen] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            const trimmed = search.trim();
            if (trimmed.length >= 2) {
                setDebouncedSearch(trimmed);
            } else {
                setDebouncedSearch('');
            }
        }, 300);
        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        setPage((prev) => (prev === 1 ? prev : 1));
    }, [debouncedSearch, categoryId, statusFilter]);

    const loadCategories = useCallback(async () => {
        try {
            const data = await api<{ items: Category[] }>('/inventory/categories');
            setCategories(data.items || []);
        } catch (err: any) {
            setError(err?.message || t('errors.products.loadCategoriesFailed'));
        }
    }, [api, t]);

    const loadProducts = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (debouncedSearch) params.set('search', debouncedSearch);
            if (categoryId) params.set('categoryId', categoryId);
            if (statusFilter !== 'all') params.set('isActive', statusFilter === 'active' ? 'true' : 'false');
            params.set('page', String(page));
            params.set('pageSize', String(PAGE_SIZE));

            const data = await api<{ items: Product[]; total: number }>(`/inventory/products?${params.toString()}`);
            setProducts(data.items || []);
            setTotal(data.total || 0);
        } catch (err: any) {
            setError(err?.message || t('errors.products.loadFailed'));
        } finally {
            setIsLoading(false);
        }
    }, [api, categoryId, debouncedSearch, page, statusFilter, t]);

    useEffect(() => {
        loadCategories();
    }, [loadCategories]);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    const handleRefreshCatalog = async () => {
        await loadCategories();
        await loadProducts();
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const canPrev = page > 1;
    const canNext = page < totalPages;

    const { formatCurrency, locale } = useCurrencyFormatter();

    const formatDate = useCallback((value?: string | null) => {
        if (!value) return t('common.placeholder');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return t('common.placeholder');
        return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    }, [locale, t]);

    const columns: Column<Product>[] = useMemo(
        () => [
            {
                header: t('products.table.product'),
                accessorKey: 'name',
                cell: (row: Product) => (
                    <div className="products-table__title">
                        <div className="products-table__name">{row.name}</div>
                        <div className="products-table__sku">{t('products.table.sku', { sku: row.sku })}</div>
                    </div>
                )
            },
            {
                header: t('products.table.category'),
                accessorKey: 'category_name',
                cell: (row: Product) => row.category_name || t('products.table.uncategorized')
            },
            {
                header: t('products.table.unit'),
                accessorKey: 'unit_name',
                cell: (row: Product) => row.unit_name ? `${row.unit_name} (${row.unit_abbr || '-'})` : t('common.placeholder')
            },
            {
                header: t('products.table.price'),
                accessorKey: 'price',
                cell: (row: Product) => formatCurrency(row.price || 0)
            },
            {
                header: t('common.status'),
                accessorKey: 'is_active',
                cell: (row: Product) => (
                    <StatusBadge variant={(row.is_active ?? 1) === 1 ? 'success' : 'neutral'} size="sm">
                        {(row.is_active ?? 1) === 1 ? t('common.active') : t('common.inactive')}
                    </StatusBadge>
                )
            },
            {
                header: t('products.table.updated'),
                accessorKey: 'updated_at',
                cell: (row: Product) => formatDate(row.updated_at)
            }
        ],
        [formatCurrency, formatDate, t]
    );

    const categoryOptions = useMemo(() => {
        return categories.map((category) => ({
            id: String(category.id),
            label: `${category.name}${category.is_active === 0 ? ` (${t('common.inactive')})` : ''}`
        }));
    }, [categories, t]);

    return (
        <div className="products-page">
            <PageHeader
                title={t('nav.routes.products.title')}
                subtitle={t('nav.routes.products.subtitle')}
                backButton={<BackButton />}
                actions={(
                    <div className="products-page__actions">
                        <PermissionGate
                            perm={PERMISSIONS.PRD_CREATE}
                            tooltip={t('errors.products.createDenied')}
                        >
                            <Button variant="primary" onClick={() => navigate('/products/new')}>
                                {t('products.actions.newProduct')}
                            </Button>
                        </PermissionGate>
                        <PermissionGate
                            perm={PERMISSIONS.PRD_EDIT}
                            tooltip={t('errors.products.manageCategoriesDenied')}
                        >
                            <Button variant="secondary" onClick={() => setIsCategoryOpen(true)}>
                                {t('products.actions.manageCategories')}
                            </Button>
                        </PermissionGate>
                        <PermissionGate
                            perm={PERMISSIONS.PRD_EDIT}
                            tooltip={t('errors.products.manageUnitsDenied')}
                        >
                            <Button variant="secondary" onClick={() => setIsUnitOpen(true)}>
                                {t('products.actions.manageUnits')}
                            </Button>
                        </PermissionGate>
                    </div>
                )}
            />

            {error && <div className="products-page__error">{error}</div>}
            {isLoading && <div className="products-page__loading">{t('products.loading')}</div>}

            <div className="products-page__grid">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('common.filters')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="products-page__filters">
                            <Input
                                label={t('common.search')}
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder={t('products.searchPlaceholder')}
                            />
                            <Select
                                label={t('products.filters.category')}
                                value={categoryId}
                                onChange={(event) => setCategoryId(event.target.value)}
                            >
                                <option value="">{t('products.filters.allCategories')}</option>
                                {categoryOptions.map((category) => (
                                    <option key={category.id} value={category.id}>{category.label}</option>
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
                            <div className="products-page__search-hint">
                                {t('common.searchMinHint')}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('products.summary.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="products-page__summary">
                            <div className="products-page__summary-item">
                                <span className="products-page__summary-label">{t('products.summary.results')}</span>
                                <span className="products-page__summary-value">{total}</span>
                                <span className="products-page__summary-hint">{t('products.summary.resultsHint')}</span>
                            </div>
                            <div className="products-page__summary-item">
                                <span className="products-page__summary-label">{t('products.summary.showing')}</span>
                                <span className="products-page__summary-value">{products.length}</span>
                                <span className="products-page__summary-hint">{t('products.summary.showingHint')}</span>
                            </div>
                            <div className="products-page__summary-item">
                                <span className="products-page__summary-label">{t('common.page')}</span>
                                <span className="products-page__summary-value">{page} / {totalPages}</span>
                                <span className="products-page__summary-hint">{t('products.summary.pageHint')}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="products-page__table-header">
                    <CardTitle>{t('products.table.title')}</CardTitle>
                    <div className="products-page__pagination">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={!canPrev}
                        >
                            {t('common.previous')}
                        </Button>
                        <span className="products-page__pagination-text">
                            {t('common.pageOf', { page, totalPages })}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                            disabled={!canNext}
                        >
                            {t('common.next')}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table
                        data={products}
                        columns={columns}
                        isLoading={isLoading}
                        onRowClick={(row) => row.id && navigate(`/products/${row.id}`)}
                    />
                    {!isLoading && !error && products.length === 0 && (
                        <div className="products-page__empty">
                            <div className="products-page__empty-title">{t('products.empty.title')}</div>
                            <div className="products-page__empty-description">
                                {t('products.empty.description')}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <CategoryManager
                isOpen={isCategoryOpen}
                onClose={() => setIsCategoryOpen(false)}
                onUpdated={handleRefreshCatalog}
            />
            <UnitManager
                isOpen={isUnitOpen}
                onClose={() => setIsUnitOpen(false)}
                onUpdated={handleRefreshCatalog}
            />
        </div>
    );
};

export default ProductsPage;

import { useEffect, useState } from 'react';
import { Button, Input } from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';
import { ProductCategoryTabs } from './ProductCategoryTabs';
import { Product } from '../../context/POSContext';
import { useKey } from 'react-use';
import { useRef } from 'react';

const PAGE_SIZE = 24;

type ProductCategory = {
    id: number;
    name: string;
    color?: string | null;
    is_active?: boolean | number | null;
};

const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    if (index === -1) return text;
    return (
        <>
            {text.slice(0, index)}
            <mark className="pos-highlight">{text.slice(index, index + query.length)}</mark>
            {text.slice(index + query.length)}
        </>
    );
};

export const OrderPad = ({
    onAdd,
    formatCurrency
}: {
    onAdd: (p: Product) => void;
    formatCurrency: (value: number) => string;
}) => {
    const api = useApi();
    const { t } = useTranslation();
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [categories, setCategories] = useState<ProductCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [categoriesLoading, setCategoriesLoading] = useState(true);
    const searchRef = useRef<HTMLInputElement>(null);

    useKey('/', (e) => {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
            e.preventDefault();
            searchRef.current?.focus();
        }
    });

    // Alt + 1-9 for categories
    useKey((e) => e.altKey && e.key >= '1' && e.key <= '9', (e) => {
        const index = parseInt(e.key) - 1;
        if (categories[index]) {
            setSelectedCategoryId(categories[index].id);
        }
    }, {}, [categories]);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, selectedCategoryId]);

    useEffect(() => {
        const loadCategories = async () => {
            setCategoriesLoading(true);
            try {
                const data = await api<{ items: ProductCategory[] }>('/inventory/categories');
                const activeCategories = (data.items || []).filter(category => category.is_active !== false && category.is_active !== 0);
                setCategories(activeCategories);
                setSelectedCategoryId(currentCategoryId => {
                    if (currentCategoryId && activeCategories.some(category => category.id === currentCategoryId)) {
                        return currentCategoryId;
                    }
                    return activeCategories[0]?.id ?? null;
                });
            } catch (err: any) {
                console.error('Failed to load categories:', err);
                setCategories([]);
                setSelectedCategoryId(null);
            } finally {
                setCategoriesLoading(false);
            }
        };
        loadCategories();
    }, [api]);

    const [inventorySettings, setInventorySettings] = useState<any>({});

    useEffect(() => {
        let mounted = true;
        api<any>('/settings/inventory')
            .then(data => { if (mounted && data) setInventorySettings(data); })
            .catch(() => {});
        return () => { mounted = false; };
    }, [api]);

    useEffect(() => {
        const loadProducts = async () => {
            if (categoriesLoading) {
                return;
            }
            if (categories.length > 0 && selectedCategoryId === null) {
                setProducts([]);
                setTotal(0);
                return;
            }
            if (debouncedSearch.length === 1) {
                setProducts([]);
                setTotal(0);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const categoryParam = selectedCategoryId !== null ? `&categoryId=${selectedCategoryId}` : '';
                const data = await api<{ items: Product[]; total: number }>(
                    `/pos/products?search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${PAGE_SIZE}${categoryParam}`
                );
                setProducts(prev => (page === 1 ? data.items : [...prev, ...data.items]));
                setTotal(data.total || 0);
            } catch (err: any) {
                setError(err?.message || t('errors.pos.loadProductsFailed'));
            } finally {
                setLoading(false);
            }
        };

        loadProducts();
    }, [api, categories.length, categoriesLoading, debouncedSearch, page, selectedCategoryId, t]);

    const canLoadMore = products.length < total;

    return (
        <div className="pos-order-pad">
            <div className="pos-search">
                <Input
                    ref={searchRef}
                    label={t('pos.productSearchLabel')}
                    placeholder={t('pos.productSearchPlaceholder') + ' (/)'}
                    value={search}
                    onChange={(event) => setSearch((event.target as HTMLInputElement).value)}
                />
            </div>

            <ProductCategoryTabs
                categories={categories}
                selectedCategoryId={selectedCategoryId}
                onChange={setSelectedCategoryId}
                isLoading={categoriesLoading}
            />

            {error && <div className="pos-inline-error">{error}</div>}
            {debouncedSearch.length > 0 && debouncedSearch.length < 2 && (
                <div className="pos-empty">{t('pos.searchMinHint')}</div>
            )}
            <div className="pos-product-grid">
                {loading && products.length === 0 && <div className="pos-empty">{t('pos.loadingProducts')}</div>}
                {!loading && products.length === 0 && (
                    <div className="pos-empty">
                        {debouncedSearch.length >= 2 
                            ? t('pos.noProductsMatch', 'No products match your search') 
                            : t('pos.noProductsInCategory', 'No products found in this category')}
                    </div>
                )}
                {products.map((product) => {
                    const isOutOfStock = product.stock_quantity != null && product.stock_quantity <= 0;
                    const showStock = product.stock_quantity != null;
                    const isRecipe = product.type === 'RECIPE' || product.type === 'COMBO';

                    return (
                        <button
                            key={product.id}
                            className={`pos-product-tile ${isOutOfStock ? 'pos-product-tile--oos' : ''}`}
                            onClick={() => onAdd(product)}
                            disabled={isOutOfStock && !inventorySettings.allowNegativeStock}
                        >
                            {isRecipe && (
                                <span className="pos-product-badge pos-product-badge--recipe">
                                    {product.type === 'COMBO' ? t('pos.type.combo', 'Combo') : t('pos.type.recipe', 'Recipe')}
                                </span>
                            )}
                            {isOutOfStock && (
                                <span className="pos-product-badge pos-product-badge--oos">
                                    {t('inventory.outOfStock', 'OOS')}
                                </span>
                            )}
                            <div className="pos-product-tile__content">
                                <span className="pos-product-name">{highlightMatch(product.name, debouncedSearch)}</span>
                                <div className="pos-product-tile__footer">
                                    <span className="pos-product-price">{formatCurrency(product.price)}</span>
                                    {showStock && (
                                        <span className={`pos-product-stock ${(product.stock_quantity ?? 0) < (product.min_stock_level || 5) ? 'pos-product-stock--low' : ''}`}>
                                            {product.stock_quantity}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}
                {canLoadMore && (
                    <div className="pos-load-more">
                        <Button
                            variant="secondary"
                            onClick={() => setPage(p => p + 1)}
                            isLoading={loading}
                        >
                            {t('common.loadMore')}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

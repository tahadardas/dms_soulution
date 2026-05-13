import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, PageHeader, Select, Switch, useToast } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import CategoryManager from '../components/products/CategoryManager';
import RecipeEditor from '../components/products/RecipeEditor';
import UnitManager from '../components/products/UnitManager';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { useCan } from '../hooks/useCan';
import { PERMISSIONS } from '../lib/permissions';
import { Category, Product, RecipeLine, Unit } from '../types/products';
import { useTranslation } from 'react-i18next';
import '../styles/ProductFormPage.css';

type FormState = {
    name: string;
    sku: string;
    type: string;
    price: string;
    description: string;
    min_stock_level: string;
    category_id: string;
    unit_id: string;
    is_active: boolean;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const DEFAULT_FORM: FormState = {
    name: '',
    sku: '',
    type: 'FINISHED_GOOD',
    price: '0',
    description: '',
    min_stock_level: '',
    category_id: '',
    unit_id: '',
    is_active: true
};

const hydrateForm = (product: Product): FormState => ({
    name: product.name || '',
    sku: product.sku || '',
    type: product.type || 'FINISHED_GOOD',
    price: product.price !== undefined && product.price !== null ? String(product.price) : '0',
    description: product.description || '',
    min_stock_level: product.min_stock_level !== null && product.min_stock_level !== undefined
        ? String(product.min_stock_level)
        : '',
    category_id: product.category_id ? String(product.category_id) : '',
    unit_id: product.unit_id ? String(product.unit_id) : '',
    is_active: (product.is_active ?? 1) === 1
});

const parseOptionalNumber = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
};

export interface ProductFormPageProps {
    mode: 'create' | 'edit';
    productId?: string;
}

export const ProductFormPage: React.FC<ProductFormPageProps> = ({ mode, productId }) => {
    const api = useApi();
    const toast = useToast();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const canEdit = useCan(PERMISSIONS.PRD_EDIT);
    const canCreate = useCan(PERMISSIONS.PRD_CREATE);
    const isEdit = mode === 'edit';
    const isReadOnly = isEdit ? !canEdit : !canCreate;
    const [form, setForm] = useState<FormState>(DEFAULT_FORM);
    const [errors, setErrors] = useState<FormErrors>({});
    const [product, setProduct] = useState<Product | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [ingredients, setIngredients] = useState<Product[]>([]);
    const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);
    const [isLoading, setIsLoading] = useState(isEdit);
    const [isRefLoading, setIsRefLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [isUnitOpen, setIsUnitOpen] = useState(false);

    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const formatTimestamp = useCallback((value?: string | null) => {
        if (!value) return t('common.placeholder');
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return t('common.placeholder');
        return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    }, [locale, t]);

    const typeOptions = useMemo(() => ([
        { value: 'FINISHED_GOOD', label: t('products.form.types.finishedGood') },
        { value: 'RAW_MATERIAL', label: t('products.form.types.rawMaterial') },
        { value: 'SERVICE', label: t('products.form.types.service') }
    ]), [t]);

    const updateField = (key: keyof FormState, value: string | boolean) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    };

    const loadReferences = useCallback(async () => {
        setIsRefLoading(true);
        try {
            const [categoriesData, unitsData, ingredientData] = await Promise.all([
                api<{ items: Category[] }>('/inventory/categories'),
                api<{ items: Unit[] }>('/inventory/units'),
                api<{ items: Product[] }>('/inventory/products?isActive=true&pageSize=500&type=RAW_MATERIAL')
            ]);
            setCategories(categoriesData.items || []);
            setUnits(unitsData.items || []);
            setIngredients(ingredientData.items || []);
        } catch (err: any) {
            const message = err?.message || t('errors.products.referencesLoadFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsRefLoading(false);
        }
    }, [api, t, toast]);

    const loadProduct = useCallback(async () => {
        if (!isEdit) {
            setIsLoading(false);
            return;
        }
        const numericId = Number(productId);
        if (!productId || Number.isNaN(numericId)) {
            setError(t('errors.products.notFound'));
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const productData = await api<Product>(`/inventory/products/${numericId}`);
            setProduct(productData);
            setForm(hydrateForm(productData));
            const recipeData = await api<RecipeLine[]>(`/inventory/products/${numericId}/recipe`);
            setRecipeLines(recipeData || []);
        } catch (err: any) {
            const message = err?.message || t('errors.products.loadFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, [api, isEdit, productId, t, toast]);

    useEffect(() => {
        loadReferences();
    }, [loadReferences]);

    useEffect(() => {
        loadProduct();
    }, [loadProduct]);

    const isPageLoading = isLoading || isRefLoading;
    const disableControls = isReadOnly || isSaving || isPageLoading;
    const shouldShowRecipe = form.type === 'FINISHED_GOOD';

    const validationErrors = useMemo(() => {
        if (!Object.keys(errors).length) return null;
        return errors;
    }, [errors]);

    const validate = () => {
        const nextErrors: FormErrors = {};
        if (!form.name.trim()) nextErrors.name = t('errors.products.validation.nameRequired');
        if (!form.sku.trim()) nextErrors.sku = t('errors.products.validation.skuRequired');
        if (!form.type) nextErrors.type = t('errors.products.validation.typeRequired');
        const priceValue = Number(form.price);
        if (Number.isNaN(priceValue) || priceValue < 0) {
            nextErrors.price = t('errors.products.validation.priceInvalid');
        }
        if (form.min_stock_level.trim()) {
            const minValue = Number(form.min_stock_level);
            if (Number.isNaN(minValue) || minValue < 0) {
                nextErrors.min_stock_level = t('errors.products.validation.minStockInvalid');
            }
        }
        return nextErrors;
    };

    const validateRecipeLines = (): boolean => {
        if (!shouldShowRecipe) return true;
        for (const line of recipeLines) {
            if (!line.ingredient_id || line.ingredient_id <= 0) return false;
            if (!line.quantity || line.quantity <= 0) return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (isReadOnly) {
            toast.error(t('errors.products.saveDenied'));
            return;
        }
        if (isEdit && (!productId || Number.isNaN(Number(productId)))) {
            toast.error(t('errors.products.missingId'));
            return;
        }
        const nextErrors = validate();
        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors);
            toast.error(t('errors.products.validationFix'));
            return;
        }
        if (!validateRecipeLines()) {
            toast.error(t('errors.products.recipeValidation'));
            return;
        }
        setErrors({});
        setIsSaving(true);
        setError('');
        try {
            const payload = {
                name: form.name.trim(),
                sku: form.sku.trim(),
                type: form.type,
                price: Number(form.price || 0),
                description: form.description.trim() || null,
                min_stock_level: parseOptionalNumber(form.min_stock_level),
                category_id: form.category_id ? Number(form.category_id) : null,
                unit_id: form.unit_id ? Number(form.unit_id) : null,
                is_active: form.is_active ? 1 : 0
            };

            let nextProductId = Number(productId);
            if (isEdit) {
                const updated = await api<Product>(`/inventory/products/${nextProductId}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                setProduct(updated);
            } else {
                const created = await api<Product>('/inventory/products', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                setProduct(created);
                nextProductId = Number(created.id);
            }

            if (nextProductId && (shouldShowRecipe || isEdit)) {
                const items = shouldShowRecipe ? recipeLines : [];
                await api(`/inventory/products/${nextProductId}/recipe`, {
                    method: 'PUT',
                    body: JSON.stringify({ items })
                });
            }

            toast.success(isEdit ? t('toast.products.updated') : t('toast.products.created'));
            if (!isEdit && nextProductId) {
                navigate(`/products/${nextProductId}`);
            }
        } catch (err: any) {
            const message = err?.message || t('errors.products.saveFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchive = async () => {
        if (!product?.id) return;
        if (!window.confirm(t('products.form.archiveConfirm'))) {
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            await api(`/inventory/products/${product.id}`, { method: 'DELETE' });
            toast.success(t('toast.products.archived'));
            navigate('/products');
        } catch (err: any) {
            const message = err?.message || t('errors.products.archiveFailed');
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCatalogRefresh = async () => {
        await loadReferences();
    };

    const activeUnits = useMemo(
        () => units.filter((unit) => (unit.is_active ?? 1) === 1),
        [units]
    );

    const recipeIngredients = useMemo(() => {
        const currentId = Number(productId);
        return ingredients.filter((item) => (item.is_active ?? 1) === 1 && item.id !== currentId);
    }, [ingredients, productId]);

    const handleCreateIngredient = () => {
        navigate('/products/new?type=RAW_MATERIAL');
    };

    return (
        <div className="product-form-page">
            <PageHeader
                title={isEdit ? t('products.form.titleEdit') : t('products.form.titleNew')}
                subtitle={isEdit ? t('products.form.subtitleEdit') : t('products.form.subtitleNew')}
                backButton={<BackButton />}
                actions={(
                    <div className="product-form-page__actions">
                        {isEdit && (
                            <PermissionGate
                                perm={PERMISSIONS.PRD_EDIT}
                                tooltip={t('errors.products.archiveDenied')}
                            >
                                <Button variant="secondary" onClick={handleArchive} isLoading={isSaving}>
                                    {t('products.form.actions.archive')}
                                </Button>
                            </PermissionGate>
                        )}
                        <PermissionGate
                            perm={isEdit ? PERMISSIONS.PRD_EDIT : PERMISSIONS.PRD_CREATE}
                            tooltip={t('errors.products.saveDenied')}
                        >
                            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
                                {isEdit ? t('common.saveChanges') : t('products.form.actions.create')}
                            </Button>
                        </PermissionGate>
                    </div>
                )}
            />

            {error && <div className="product-form-page__error">{error}</div>}
            {isPageLoading && (
                <div className="product-form-page__loading">
                    {isEdit ? t('products.form.loadingEdit') : t('products.form.loadingNew')}
                </div>
            )}
            {isReadOnly && !isPageLoading && (
                <div className="product-form-page__notice">
                    {t('products.form.readOnlyNotice')}
                </div>
            )}

            <Card>
                <CardHeader className="product-form-card__header">
                    <div>
                        <CardTitle>{t('products.form.sections.basics')}</CardTitle>
                        <div className="product-form-card__subtitle">{t('products.form.sections.basicsSubtitle')}</div>
                    </div>
                    <div className="product-form-card__actions">
                        <PermissionGate
                            perm={PERMISSIONS.PRD_EDIT}
                            tooltip={t('errors.products.manageCategoriesDenied')}
                        >
                            <Button variant="ghost" size="sm" onClick={() => setIsCategoryOpen(true)}>
                                {t('products.actions.manageCategories')}
                            </Button>
                        </PermissionGate>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="product-form-grid">
                        <Input
                            label={t('products.form.fields.name')}
                            value={form.name}
                            onChange={(event) => updateField('name', event.target.value)}
                            error={validationErrors?.name}
                            disabled={disableControls}
                        />
                        <Input
                            label={t('products.form.fields.sku')}
                            value={form.sku}
                            onChange={(event) => updateField('sku', event.target.value)}
                            error={validationErrors?.sku}
                            disabled={disableControls}
                        />
                        <Select
                            label={t('products.form.fields.type')}
                            value={form.type}
                            onChange={(event) => updateField('type', event.target.value)}
                            error={validationErrors?.type}
                            disabled={disableControls}
                        >
                            {typeOptions.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </Select>
                        <Select
                            label={t('products.form.fields.category')}
                            value={form.category_id}
                            onChange={(event) => updateField('category_id', event.target.value)}
                            disabled={disableControls}
                        >
                            <option value="">{t('products.form.uncategorized')}</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </Select>
                        <div className="product-form-field--full">
                            <Input
                                label={t('products.form.fields.description')}
                                value={form.description}
                                onChange={(event) => updateField('description', event.target.value)}
                                disabled={disableControls}
                            />
                        </div>
                        <div className="product-form-switch">
                            <span className="product-form-switch__label">{t('common.active')}</span>
                            <Switch
                                checked={form.is_active}
                                onCheckedChange={(checked) => updateField('is_active', checked)}
                                disabled={disableControls}
                            />
                        </div>
                    </div>
                    {!isRefLoading && categories.length === 0 && (
                        <div className="product-form-empty">
                            {t('products.form.emptyCategories')}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="product-form-card__header">
                    <div>
                        <CardTitle>{t('products.form.sections.inventoryPricing')}</CardTitle>
                        <div className="product-form-card__subtitle">{t('products.form.sections.inventoryPricingSubtitle')}</div>
                    </div>
                    <div className="product-form-card__actions">
                        <PermissionGate
                            perm={PERMISSIONS.PRD_EDIT}
                            tooltip={t('errors.products.manageUnitsDenied')}
                        >
                            <Button variant="ghost" size="sm" onClick={() => setIsUnitOpen(true)}>
                                {t('products.actions.manageUnits')}
                            </Button>
                        </PermissionGate>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="product-form-grid">
                        <Input
                            label={t('products.form.fields.price')}
                            type="number"
                            value={form.price}
                            onChange={(event) => updateField('price', event.target.value)}
                            error={validationErrors?.price}
                            disabled={disableControls}
                        />
                        <Input
                            label={t('products.form.fields.minStock')}
                            type="number"
                            value={form.min_stock_level}
                            onChange={(event) => updateField('min_stock_level', event.target.value)}
                            error={validationErrors?.min_stock_level}
                            disabled={disableControls}
                        />
                        <Select
                            label={t('products.form.fields.unit')}
                            value={form.unit_id}
                            onChange={(event) => updateField('unit_id', event.target.value)}
                            disabled={disableControls}
                        >
                            <option value="">{t('products.form.selectUnit')}</option>
                            {activeUnits.map((unit) => (
                                <option key={unit.id} value={unit.id}>
                                    {unit.name} ({unit.abbreviation})
                                </option>
                            ))}
                        </Select>
                    </div>
                    {!isRefLoading && units.length === 0 && (
                        <div className="product-form-empty">
                            {t('products.form.emptyUnits')}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('products.form.sections.recipe')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {shouldShowRecipe ? (
                        <RecipeEditor
                            lines={recipeLines}
                            ingredients={recipeIngredients}
                            units={activeUnits}
                            onChange={setRecipeLines}
                            disabled={disableControls}
                            onCreateIngredient={handleCreateIngredient}
                        />
                    ) : (
                        <div className="product-form-hint">
                            <p>{t('products.form.recipeHint')}</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {isEdit && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t('products.form.sections.audit')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="product-form-meta">
                            <div className="product-form-meta__item">
                                <div className="product-form-meta__label">{t('products.form.audit.created')}</div>
                                <div className="product-form-meta__value">{formatTimestamp(product?.created_at)}</div>
                            </div>
                            <div className="product-form-meta__item">
                                <div className="product-form-meta__label">{t('products.form.audit.updated')}</div>
                                <div className="product-form-meta__value">{formatTimestamp(product?.updated_at)}</div>
                            </div>
                            <div className="product-form-meta__item">
                                <div className="product-form-meta__label">{t('products.form.audit.status')}</div>
                                <div className="product-form-meta__value">{form.is_active ? t('common.active') : t('common.inactive')}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <CategoryManager
                isOpen={isCategoryOpen}
                onClose={() => setIsCategoryOpen(false)}
                onUpdated={handleCatalogRefresh}
            />
            <UnitManager
                isOpen={isUnitOpen}
                onClose={() => setIsUnitOpen(false)}
                onUpdated={handleCatalogRefresh}
            />
        </div>
    );
};

export default ProductFormPage;

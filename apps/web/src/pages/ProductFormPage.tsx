import React, { useCallback, useEffect, useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    Button, Card, Input, Select, Switch, 
    useToast, StandardPage, LoadingState, FormField 
} from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import CategoryManager from '../components/products/CategoryManager';
import RecipeEditor from '../components/products/RecipeEditor';
import UnitManager from '../components/products/UnitManager';
import PermissionGate from '../components/PermissionGate';
import { useApi } from '../hooks/useApi';
import { useCan } from '../hooks/useCan';
import { PERMISSIONS } from '../lib/permissions';
import { Category, Product, RecipeLine, Unit } from '../types/products';
import { ProductFormSchema, ProductFormValues } from '@dms/shared';
import { useTranslation } from 'react-i18next';
import '../styles/ProductFormPage.css';

export interface ProductFormPageProps {
    mode: 'create' | 'edit';
    productId?: string;
}

export const ProductFormPage: React.FC<ProductFormPageProps> = ({ mode, productId }) => {
    const api = useApi();
    const toast = useToast();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const canEdit = useCan(PERMISSIONS.PRD_EDIT);
    const canCreate = useCan(PERMISSIONS.PRD_CREATE);
    const isEdit = mode === 'edit';
    const isReadOnly = isEdit ? !canEdit : !canCreate;

    const [categories, setCategories] = useState<Category[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [ingredients, setIngredients] = useState<Product[]>([]);
    const [recipeLines, setRecipeLines] = useState<RecipeLine[]>([]);
    const [isLoading, setIsLoading] = useState(isEdit);
    const [isRefLoading, setIsRefLoading] = useState(true);
    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [isUnitOpen, setIsUnitOpen] = useState(false);

    const {
        register, handleSubmit, setValue, watch, reset,
        formState: { errors, isSubmitting }
    } = useForm<ProductFormValues>({
        resolver: zodResolver(ProductFormSchema) as any,
        defaultValues: {
            name: '',
            sku: '',
            type: 'FINISHED_GOOD',
            price: 0,
            is_active: true
        }
    });

    const productType = watch('type');

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
        } finally {
            setIsRefLoading(false);
        }
    }, [api]);

    useEffect(() => {
        const loadProduct = async () => {
            if (!isEdit || !productId) return;
            setIsLoading(true);
            try {
                const productData = await api<Product>(`/inventory/products/${productId}`);
                reset({
                    name: productData.name,
                    sku: productData.sku,
                    type: productData.type as any,
                    price: productData.price,
                    description: productData.description,
                    min_stock_level: productData.min_stock_level,
                    category_id: productData.category_id,
                    unit_id: productData.unit_id,
                    is_active: productData.is_active === 1
                });
                const recipeData = await api<RecipeLine[]>(`/inventory/products/${productId}/recipe`);
                setRecipeLines(recipeData || []);
            } finally {
                setIsLoading(false);
            }
        };

        loadReferences();
        loadProduct();
    }, [api, isEdit, productId, reset, loadReferences]);

    const onSubmit: SubmitHandler<ProductFormValues> = async (data) => {
        try {
            const method = isEdit ? 'PUT' : 'POST';
            const url = isEdit ? `/inventory/products/${productId}` : '/inventory/products';
            const res = await api<Product>(url, {
                method,
                body: JSON.stringify({
                    ...data,
                    is_active: data.is_active ? 1 : 0
                })
            });

            if (data.type === 'FINISHED_GOOD') {
                await api(`/inventory/products/${isEdit ? productId : res.id}/recipe`, {
                    method: 'PUT',
                    body: JSON.stringify({ items: recipeLines })
                });
            }

            toast.success(isEdit ? t('toast.products.updated') : t('toast.products.created'));
            if (!isEdit) navigate(`/products/${res.id}`);
        } catch (err: any) {
            toast.error(err.message || t('errors.products.saveFailed'));
        }
    };

    if (isLoading || isRefLoading) return <LoadingState />;

    return (
        <StandardPage
            title={isEdit ? t('products.form.titleEdit') : t('products.form.titleNew')}
            subtitle={isEdit ? t('products.form.subtitleEdit') : t('products.form.subtitleNew')}
            actions={
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => navigate('/products')}>
                        {t('common.cancel')}
                    </Button>
                    <PermissionGate perm={isEdit ? PERMISSIONS.PRD_EDIT : PERMISSIONS.PRD_CREATE}>
                        <Button isLoading={isSubmitting} onClick={handleSubmit(onSubmit as any)}>
                            {isEdit ? t('common.saveChanges') : t('products.form.actions.create')}
                        </Button>
                    </PermissionGate>
                </div>
            }
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card title={t('products.form.sections.basics')}>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label={t('products.form.fields.name')} error={errors.name?.message} required>
                                <Input {...register('name')} />
                            </FormField>
                            <FormField label={t('products.form.fields.sku')} error={errors.sku?.message} required>
                                <Input {...register('sku')} />
                            </FormField>
                            <FormField label={t('products.form.fields.type')} error={errors.type?.message} required>
                                <Select {...register('type')}>
                                    <option value="FINISHED_GOOD">{t('products.form.types.finishedGood')}</option>
                                    <option value="RAW_MATERIAL">{t('products.form.types.rawMaterial')}</option>
                                    <option value="SERVICE">{t('products.form.types.service')}</option>
                                </Select>
                            </FormField>
                            <FormField label={t('products.form.fields.category')}>
                                <div className="flex gap-2">
                                    <Select {...register('category_id', { valueAsNumber: true })}>
                                        <option value="">{t('products.form.uncategorized')}</option>
                                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </Select>
                                    <Button variant="ghost" size="sm" onClick={() => setIsCategoryOpen(true)}>
                                        +
                                    </Button>
                                </div>
                            </FormField>
                        </div>
                    </Card>

                    <Card title={t('products.form.sections.inventoryPricing')}>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField label={t('products.form.fields.price')} error={errors.price?.message}>
                                <Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} />
                            </FormField>
                            <FormField label={t('products.form.fields.unit')}>
                                <div className="flex gap-2">
                                    <Select {...register('unit_id', { valueAsNumber: true })}>
                                        <option value="">{t('products.form.selectUnit')}</option>
                                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </Select>
                                    <Button variant="ghost" size="sm" onClick={() => setIsUnitOpen(true)}>
                                        +
                                    </Button>
                                </div>
                            </FormField>
                        </div>
                    </Card>

                    {productType === 'FINISHED_GOOD' && (
                        <Card title={t('products.form.sections.recipe')}>
                            <RecipeEditor
                                lines={recipeLines}
                                ingredients={ingredients}
                                units={units}
                                onChange={setRecipeLines}
                                disabled={isReadOnly}
                            />
                        </Card>
                    )}
                </div>

                <div className="space-y-6">
                    <Card title={t('common.status')}>
                        <div className="flex items-center justify-between">
                            <span>{t('common.active')}</span>
                            <Switch 
                                checked={watch('is_active')} 
                                onCheckedChange={(val) => setValue('is_active', val)} 
                            />
                        </div>
                    </Card>

                    <Card title={t('products.form.fields.description')}>
                        <textarea 
                            {...register('description')}
                            className="dms-input min-h-[150px] w-full p-3"
                            placeholder={t('products.form.fields.description')}
                        />
                    </Card>
                </div>
            </div>

            <CategoryManager isOpen={isCategoryOpen} onClose={() => setIsCategoryOpen(false)} onUpdated={loadReferences} />
            <UnitManager isOpen={isUnitOpen} onClose={() => setIsUnitOpen(false)} onUpdated={loadReferences} />
        </StandardPage>
    );
};

export default ProductFormPage;

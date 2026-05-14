import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
    Button, Card, Input, FormField, MoneyInput, LoadingState, 
    useToast, StandardPage 
} from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi';
import { useCurrencyFormatter } from '../hooks/useCurrencyFormatter';
import { InvoiceSchema, Invoice } from '@dms/shared';

interface InvoiceEditorProps {
    type: 'purchase' | 'sales';
    id?: string;
}

const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ type, id }) => {
    const { t } = useTranslation();
    const api = useApi();
    const toast = useToast();
    const { formatCurrency } = useCurrencyFormatter();
    const [loading, setLoading] = useState(false);
    const [partners, setPartners] = useState<any[]>([]);

    const {
        register, control, handleSubmit, setValue, watch, 
        formState: { errors, isSubmitting }
    } = useForm<Invoice>({
        resolver: zodResolver(InvoiceSchema) as any,
        defaultValues: {
            type,
            date: new Date().toISOString().split('T')[0],
            items: [{ productId: 0, name: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, total: 0 }],
            subtotal: 0,
            taxTotal: 0,
            discountTotal: 0,
            total: 0
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'items'
    });

    const watchItems = watch('items');

    useEffect(() => {
        const loadPartners = async () => {
            try {
                const endpoint = type === 'purchase' ? '/suppliers' : '/customers';
                const res = await api<any[]>(endpoint);
                setPartners(res);
            } catch (err) {
                console.error('Failed to load partners', err);
            }
        };

        const loadInvoice = async () => {
            if (!id) return;
            setLoading(true);
            try {
                const res = await api<Invoice>(`/invoices/${id}`);
                Object.entries(res).forEach(([key, value]) => {
                    setValue(key as any, value);
                });
            } finally {
                setLoading(false);
            }
        };

        loadPartners();
        loadInvoice();
    }, [api, type, id, setValue]);

    useEffect(() => {
        const subtotal = watchItems.reduce((acc: number, item: any) => acc + (item.quantity * (item.unitPrice || 0)), 0);
        const total = subtotal; 
        setValue('subtotal', subtotal);
        setValue('total', total);
    }, [watchItems, setValue]);

    const onSubmit: SubmitHandler<Invoice> = async (data) => {
        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/invoices/${id}` : '/invoices';
            await api(url, {
                method,
                body: JSON.stringify(data)
            });
            toast.success(id ? t('toast.invoice.updated') : t('toast.invoice.created'));
        } catch (err: any) {
            toast.error(err.message || t('toast.invoice.saveFailed'));
        }
    };

    if (loading) return <LoadingState />;

    return (
        <StandardPage
            title={id ? t('invoices.edit') : (type === 'purchase' ? t('invoices.newPurchase') : t('invoices.newSale'))}
            actions={
                <Button isLoading={isSubmitting} onClick={handleSubmit(onSubmit as any)}>
                    {t('common.save')}
                </Button>
            }
        >
            <form onSubmit={handleSubmit(onSubmit)} className="invoice-editor">
                <Card padding="md" className="mb-4">
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label={type === 'purchase' ? t('invoices.supplier') : t('invoices.customer')} error={errors.partnerId?.message} required>
                            <select 
                                {...register('partnerId', { valueAsNumber: true })}
                                className="dms-input"
                            >
                                <option value="">{t('common.select')}</option>
                                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </FormField>
                        <FormField label={t('common.date')} error={errors.date?.message} required>
                            <Input type="date" {...register('date')} />
                        </FormField>
                    </div>
                </Card>

                <Card padding="md" title={t('invoices.items')} className="mb-4">
                    <table className="dms-table">
                        <thead>
                            <tr>
                                <th>{t('products.name')}</th>
                                <th style={{ width: '120px' }}>{t('invoices.quantity')}</th>
                                <th style={{ width: '150px' }}>{t('invoices.unitPrice')}</th>
                                <th style={{ width: '150px' }}>{t('common.total')}</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {fields.map((field, index) => (
                                <tr key={field.id}>
                                    <td>
                                        <Input {...register(`items.${index}.name` as const)} placeholder={t('products.name')} />
                                        {errors.items?.[index]?.name && <span className="error-text text-xs text-red-500">{errors.items[index]?.name?.message}</span>}
                                    </td>
                                    <td>
                                        <Input 
                                            type="number" 
                                            step="0.001" 
                                            {...register(`items.${index}.quantity` as const, { valueAsNumber: true })} 
                                        />
                                        {errors.items?.[index]?.quantity && <span className="error-text text-xs text-red-500">{errors.items[index]?.quantity?.message}</span>}
                                    </td>
                                    <td>
                                        <MoneyInput 
                                            value={watchItems[index]?.unitPrice || 0}
                                            onChange={(val: number) => setValue(`items.${index}.unitPrice`, val)}
                                        />
                                    </td>
                                    <td>
                                        {formatCurrency((watchItems[index]?.quantity || 0) * (watchItems[index]?.unitPrice || 0))}
                                    </td>
                                    <td>
                                        <Button variant="ghost" size="sm" onClick={() => remove(index)} disabled={fields.length === 1}>
                                            🗑️
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <Button variant="secondary" size="sm" className="mt-2" onClick={() => append({ productId: 0, name: '', quantity: 1, unitPrice: 0, taxRate: 0, discount: 0, total: 0 })}>
                        + {t('invoices.addItem')}
                    </Button>
                </Card>

                <div className="flex justify-end">
                    <Card padding="md" className="w-1/3">
                        <div className="flex justify-between mb-2">
                            <span>{t('invoices.subtotal')}</span>
                            <span>{formatCurrency(watch('subtotal'))}</span>
                        </div>
                        <div className="flex justify-between font-bold text-lg border-top pt-2 mt-2">
                            <span>{t('common.total')}</span>
                            <span>{formatCurrency(watch('total'))}</span>
                        </div>
                    </Card>
                </div>
            </form>
        </StandardPage>
    );
};

export default InvoiceEditor;

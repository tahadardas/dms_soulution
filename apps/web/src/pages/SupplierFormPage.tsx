import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Input, Select, useToast } from '@dms/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import { Supplier } from '../types/invoices';

export const SupplierFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const api = useApi();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { success, error: showError } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        tax_number: '',
        currency_code: 'SYP',
        opening_balance: 0,
        is_active: 1
    });

    const loadSupplier = useCallback(async () => {
        if (!id || id === 'new') return;
        try {
            // Since we don't have a GET /suppliers/:id yet, we filter from list or we should add one.
            // Let's assume we use the list for now or I should add the endpoint.
            // Actually, I'll add the endpoint to the backend too for completeness.
            const data = await api<{ items: Supplier[] }>('/suppliers');
            const supplier = data.items.find(s => String(s.id) === id);
            if (supplier) {
                setFormData({
                    name: supplier.name,
                    phone: supplier.phone || '',
                    email: supplier.email || '',
                    address: supplier.address || '',
                    tax_number: supplier.tax_number || '',
                    currency_code: supplier.currency_code || 'SYP',
                    opening_balance: supplier.opening_balance || 0,
                    is_active: supplier.is_active ?? 1
                });
            }
        } catch (err: any) {
            showError(err?.message || 'Failed to load supplier');
        }
    }, [api, id, showError]);

    useEffect(() => {
        loadSupplier();
    }, [loadSupplier]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (id && id !== 'new') {
                await api(`/suppliers/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
                success('Supplier updated');
            } else {
                await api('/suppliers', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
                success('Supplier created');
            }
            navigate('/suppliers');
        } catch (err: any) {
            showError(err?.message || 'Failed to save supplier');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="supplier-form-page">
            <PageHeader
                title={id && id !== 'new' ? t('suppliers.actions.editSupplier') : t('suppliers.actions.newSupplier')}
                backButton={<BackButton />}
            />

            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('common.standardPage.summaryTitle')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input
                                label={t('suppliers.fields.name')}
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label={t('suppliers.fields.phone')}
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                />
                                <Input
                                    label={t('suppliers.fields.taxNumber')}
                                    value={formData.tax_number}
                                    onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                                />
                            </div>
                            <Input
                                label={t('suppliers.fields.email')}
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            <Input
                                label={t('suppliers.fields.address')}
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('nav.sections.accounting')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select
                                label={t('suppliers.fields.currency')}
                                value={formData.currency_code}
                                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                            >
                                <option value="SYP">SYP</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                            </Select>
                            <Input
                                label={t('suppliers.fields.openingBalance')}
                                type="number"
                                value={formData.opening_balance}
                                onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                                disabled={id !== 'new' && !!id} // Only set opening balance on creation
                                hint={id !== 'new' && !!id ? "Cannot change opening balance after creation" : undefined}
                            />
                            <Select
                                label={t('common.status')}
                                value={String(formData.is_active)}
                                onChange={(e) => setFormData({ ...formData, is_active: Number(e.target.value) })}
                            >
                                <option value="1">{t('common.active')}</option>
                                <option value="0">{t('common.inactive')}</option>
                            </Select>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={() => navigate('/suppliers')} disabled={isSaving}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" type="submit" isLoading={isSaving}>
                        {t('common.save')}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default SupplierFormPage;

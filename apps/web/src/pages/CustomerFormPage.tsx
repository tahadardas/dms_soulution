import React, { useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Input, useToast } from '@dms/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import { Customer } from './CustomersPage';

export const CustomerFormPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;
    const api = useApi();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { success, error: showError } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(isEdit);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        tax_number: '',
        opening_balance: 0,
        currency_code: 'SYP',
        is_active: 1
    });

    useEffect(() => {
        if (isEdit) {
            api<Customer>(`/customers/${id}`)
                .then(data => {
                    setFormData({
                        name: data.name,
                        phone: data.phone || '',
                        email: data.email || '',
                        address: data.address || '',
                        tax_number: data.tax_number || '',
                        opening_balance: data.opening_balance || 0,
                        currency_code: data.currency_code || 'SYP',
                        is_active: data.is_active
                    });
                })
                .catch(err => showError(err.message))
                .finally(() => setIsLoading(false));
        }
    }, [id, isEdit, api, showError]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (isEdit) {
                await api(`/customers/${id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify(formData) 
                });
                success(t('common.updatedSuccessfully'));
            } else {
                await api('/customers', { 
                    method: 'POST', 
                    body: JSON.stringify(formData) 
                });
                success(t('common.createdSuccessfully'));
            }
            navigate('/customers');
        } catch (err: any) {
            showError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div>Loading...</div>;

    return (
        <div className="customer-form-page">
            <PageHeader
                title={isEdit ? t('customers.actions.editCustomer') : t('customers.actions.newCustomer')}
                backButton={<BackButton />}
            />

            <form onSubmit={handleSubmit} className="max-w-2xl">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('common.basicInfo')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            label={t('customers.fields.name')}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label={t('customers.fields.phone')}
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />
                            <Input
                                label={t('customers.fields.email')}
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                        <Input
                            label={t('customers.fields.address')}
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        />
                        <Input
                            label={t('customers.fields.taxNumber')}
                            value={formData.tax_number}
                            onChange={(e) => setFormData({ ...formData, tax_number: e.target.value })}
                        />
                        
                        {!isEdit && (
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <Input
                                    label={t('customers.fields.openingBalance')}
                                    type="number"
                                    step="0.01"
                                    value={formData.opening_balance}
                                    onChange={(e) => setFormData({ ...formData, opening_balance: Number(e.target.value) })}
                                />
                                <Input
                                    label={t('customers.fields.currency')}
                                    value={formData.currency_code}
                                    onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={() => navigate('/customers')} disabled={isSaving}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" type="submit" isLoading={isSaving}>
                        {isEdit ? t('common.save') : t('common.create')}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CustomerFormPage;

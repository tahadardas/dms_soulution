import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Input, Select, useToast } from '@dms/ui';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import { Customer } from './CustomersPage';
import { Account } from '../types/accounting';
import { Branch } from '../types/inventory';

export const CustomerReceiptPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const customerIdFromQuery = searchParams.get('customerId');
    const api = useApi();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const { success, error: showError } = useToast();
    
    const [isSaving, setIsSaving] = useState(false);
    
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);

    const [formData, setFormData] = useState({
        customer_id: id || customerIdFromQuery || '',
        branch_id: '',
        account_id: '', // Destination account (Cash/Bank)
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        payment_method: 'CASH',
        reference_number: '',
        notes: ''
    });

    const loadData = useCallback(async () => {
        try {
            const [custData, accData, branchData] = await Promise.all([
                api<{ items: Customer[] }>('/customers'),
                api<{ items: Account[] }>('/accounting/accounts'),
                api<{ items: Branch[] }>('/branches')
            ]);
            
            setCustomers(custData.items);
            setAccounts(accData.items.filter(a => a.type === 'ASSET' && !a.is_control));
            setBranches(branchData.items);
            
            if (branchData.items.length > 0 && !formData.branch_id) {
                setFormData(prev => ({ ...prev, branch_id: String(branchData.items[0].id) }));
            }

            if (accData.items.length > 0 && !formData.account_id) {
                const cashAcc = accData.items.find(a => a.code === '1010' || a.name.includes('Cash') || a.name.includes('صندوق'));
                if (cashAcc) {
                    setFormData(prev => ({ ...prev, account_id: String(cashAcc.id) }));
                }
            }
        } catch (err: any) {
            showError(err?.message || 'Failed to load data');
        }
    }, [api, showError]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customer_id || !formData.account_id || !formData.amount || !formData.branch_id) {
            showError('Please fill all required fields');
            return;
        }

        setIsSaving(true);
        try {
            await api(`/customers/${formData.customer_id}/receipts`, {
                method: 'POST',
                body: JSON.stringify({
                    ...formData,
                    customer_id: Number(formData.customer_id),
                    branch_id: Number(formData.branch_id),
                    account_id: Number(formData.account_id),
                    amount: Number(formData.amount)
                })
            });
            success('Receipt recorded successfully');
            navigate('/customers');
        } catch (err: any) {
            showError(err?.message || 'Failed to record receipt');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="customer-receipt-page">
            <PageHeader
                title={t('customers.actions.recordReceipt')}
                backButton={<BackButton />}
            />

            <form onSubmit={handleSubmit} className="max-w-4xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('customers.receipt.details')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select
                                label={t('customers.fields.name')}
                                value={formData.customer_id}
                                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                                required
                                disabled={!!id}
                            >
                                <option value="">{t('common.select')}</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </Select>

                            <Select
                                label={t('common.branch')}
                                value={formData.branch_id}
                                onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                                required
                            >
                                <option value="">{t('common.select')}</option>
                                {branches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </Select>

                            <Input
                                label={t('common.date')}
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />

                            <Input
                                label={t('customers.fields.amount')}
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                                required
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('customers.receipt.method')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Select
                                label={t('customers.fields.destinationAccount')}
                                value={formData.account_id}
                                onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                                required
                                hint={t('customers.hints.destinationAccount')}
                            >
                                <option value="">{t('common.select')}</option>
                                {accounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                ))}
                            </Select>

                            <Select
                                label={t('customers.fields.paymentMethod')}
                                value={formData.payment_method}
                                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                            >
                                <option value="CASH">{t('customers.paymentMethods.cash')}</option>
                                <option value="BANK">{t('customers.paymentMethods.bank')}</option>
                                <option value="CHECK">{t('customers.paymentMethods.check')}</option>
                            </Select>

                            <Input
                                label={t('customers.fields.referenceNumber')}
                                value={formData.reference_number}
                                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                                placeholder="Ref #, Check #"
                            />

                            <Input
                                label={t('common.notes')}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </CardContent>
                    </Card>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="ghost" onClick={() => navigate('/customers')} disabled={isSaving}>
                        {t('common.cancel')}
                    </Button>
                    <Button variant="primary" type="submit" isLoading={isSaving}>
                        {t('customers.actions.recordReceipt')}
                    </Button>
                </div>
            </form>
        </div>
    );
};

export default CustomerReceiptPage;

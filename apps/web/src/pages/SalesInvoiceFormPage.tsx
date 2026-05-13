import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader, Input, Select, Table, Column } from '@dms/ui';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { SalesInvoice, SalesInvoiceLine } from '../types/invoices';
import { Product } from '../types/products';
import { Branch } from '../types/inventory';
import { useTranslation } from 'react-i18next';
import { BackButton } from '../components/BackButton';
import { useAuth } from '../context/AuthContext';

interface CustomerOption {
    id: number;
    name: string;
}

export const SalesInvoiceFormPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const { t } = useTranslation();
    
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [branches, setBranches] = useState<Branch[]>([]);
    
    const [invoice, setInvoice] = useState<Partial<SalesInvoice>>({
        date: new Date().toISOString().split('T')[0],
        status: 'DRAFT',
        branch_id: user?.branch_id || 1,
        lines: []
    });

    const [isSaving, setIsSaving] = useState(false);

    const loadData = useCallback(async () => {
        try {
            const [cData, pData, bData] = await Promise.all([
                api<{ items: CustomerOption[] }>('/customers'),
                api<{ items: Product[] }>('/pos/products?pageSize=1000'),
                api<{ items: Branch[] }>('/branches')
            ]);
            setCustomers(cData.items || []);
            setProducts(pData.items || []);
            setBranches(bData.items || []);

            if (id) {
                const inv = await api<SalesInvoice>(`/sales-invoices/${id}`);
                setInvoice(inv);
            }
        } catch (err) {
            console.error('Failed to load form data', err);
        }
    }, [api, id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const addLine = () => {
        const newLine: SalesInvoiceLine = {
            id: Date.now(),
            invoice_id: invoice.id || '',
            product_id: 0,
            quantity: 1,
            unit_price: 0,
            cost_at_time: 0,
            total_price: 0,
            tax_amount: 0
        };
        const newLines = [...(invoice.lines || []), newLine];
        setInvoice({ ...invoice, lines: newLines });
    };

    const updateLine = (index: number, updates: Partial<SalesInvoiceLine>) => {
        const lines = [...(invoice.lines || [])];
        lines[index] = { ...lines[index], ...updates };
        lines[index].total_price = lines[index].quantity * lines[index].unit_price;
        setInvoice({ ...invoice, lines });
    };

    const removeLine = (index: number) => {
        const lines = [...(invoice.lines || [])];
        lines.splice(index, 1);
        setInvoice({ ...invoice, lines });
    };

    const calculateTotals = () => {
        const total = invoice.lines?.reduce((sum, l) => sum + l.total_price, 0) || 0;
        const tax = invoice.lines?.reduce((sum, l) => sum + l.tax_amount, 0) || 0;
        return { total, tax };
    };

    const handleSave = async (post: boolean = false) => {
        setIsSaving(true);
        try {
            const { total, tax } = calculateTotals();
            const payload = {
                ...invoice,
                total_amount: total,
                tax_amount: tax
            };

            let result: SalesInvoice;
            if (id) {
                result = await api<SalesInvoice>(`/sales-invoices/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            } else {
                result = await api<SalesInvoice>('/sales-invoices', { method: 'POST', body: JSON.stringify(payload) });
            }

            if (post) {
                await api(`/sales-invoices/${result.id}/post`, { method: 'POST' });
            }

            navigate('/sales-invoices');
        } catch {
            alert('Failed to save invoice');
        } finally {
            setIsSaving(false);
        }
    };

    const { total, tax } = calculateTotals();

    const getLineIndex = (line: SalesInvoiceLine) => (invoice.lines || []).findIndex((candidate) => candidate.id === line.id);

    const columns: Column<SalesInvoiceLine>[] = [
        {
            header: t('invoices.fields.product'),
            cell: (line) => {
                const index = getLineIndex(line);
                return (
                    <Select
                        value={line.product_id}
                        onChange={(e) => {
                            const pid = Number(e.target.value);
                            const prod = products.find(p => p.id === pid);
                            updateLine(index, {
                                product_id: pid,
                                unit_price: prod?.price || 0,
                                cost_at_time: prod?.cost || 0
                            });
                        }}
                    >
                        <option value="0">{t('common.select')}</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </Select>
                );
            }
        },
        {
            header: t('invoices.fields.quantity'),
            cell: (line) => {
                const index = getLineIndex(line);
                return (
                    <Input
                        type="number"
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                    />
                );
            }
        },
        {
            header: t('invoices.fields.unitPrice'),
            cell: (line) => {
                const index = getLineIndex(line);
                return (
                    <Input
                        type="number"
                        value={line.unit_price}
                        onChange={(e) => updateLine(index, { unit_price: Number(e.target.value) })}
                    />
                );
            }
        },
        {
            header: t('invoices.fields.total'),
            cell: (line) => (line.total_price || 0).toLocaleString()
        },
        {
            header: '',
            cell: (line) => {
                const index = getLineIndex(line);
                return <Button variant="ghost" size="sm" onClick={() => removeLine(index)}>×</Button>;
            }
        }
    ];

    return (
        <div className="sales-invoice-form">
            <PageHeader
                title={id ? t('invoices.actions.editSale') : t('invoices.actions.newSale')}
                backButton={<BackButton />}
                actions={(
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={() => handleSave(false)} disabled={isSaving}>
                            {t('invoices.actions.saveDraft')}
                        </Button>
                        <Button variant="primary" onClick={() => handleSave(true)} disabled={isSaving}>
                            {t('invoices.actions.post')}
                        </Button>
                    </div>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="md:col-span-3">
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        <Select 
                            label={t('invoices.fields.customer')} 
                            value={invoice.customer_id}
                            onChange={(e) => setInvoice({...invoice, customer_id: Number(e.target.value)})}
                        >
                            <option value="">{t('common.select')}</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        <Input 
                            label={t('invoices.fields.invoiceNumber')} 
                            value={invoice.invoice_number}
                            onChange={(e) => setInvoice({...invoice, invoice_number: e.target.value})}
                        />
                        <Input 
                            type="date" 
                            label={t('invoices.fields.date')} 
                            value={invoice.date}
                            onChange={(e) => setInvoice({...invoice, date: e.target.value})}
                        />
                        <Select 
                            label={t('common.branch')} 
                            value={invoice.branch_id}
                            onChange={(e) => setInvoice({...invoice, branch_id: Number(e.target.value)})}
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </Select>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-4">
                        <div className="text-sm text-gray-500 mb-1">{t('invoices.fields.total')}</div>
                        <div className="text-3xl font-bold">{total.toLocaleString()}</div>
                        <div className="text-sm text-gray-500 mt-4 mb-1">{t('invoices.fields.tax')}</div>
                        <div className="text-xl">{tax.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex justify-between items-center">
                    <CardTitle>{t('journals.entry.linesTitle')}</CardTitle>
                    <Button variant="secondary" size="sm" onClick={addLine}>
                        {t('journals.editor.addLine')}
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table data={invoice.lines || []} columns={columns} />
                    {(!invoice.lines || invoice.lines.length === 0) && (
                        <div className="p-8 text-center text-gray-400">
                            {t('standardPage.emptyDescription')}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default SalesInvoiceFormPage;

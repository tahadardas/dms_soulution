import React, { useState, useEffect } from 'react';
import { 
    Button, 
    Card, 
    CardContent,
    CardHeader,
    CardTitle,
    Table, 
    Modal, 
    Input, 
    Select, 
    StatusBadge,
    PageHeader,
    Tabs,
    Switch,
    useToast
} from '@dms/ui';
import { useTranslation } from 'react-i18next';
import { useApi } from '../hooks/useApi';
import { useCurrencyFormatter } from '../hooks/useCurrencyFormatter';

interface Courier {
    id: number;
    name: string;
    phone: string;
    active: boolean;
    commissionType: 'NONE' | 'FIXED_PER_ORDER' | 'PERCENT_OF_ORDER' | 'MANUAL';
    commissionValue: number;
}

const DeliveryCouriersPage: React.FC = () => {
    const { t } = useTranslation();
    const api = useApi();
    const { formatCurrency } = useCurrencyFormatter();
    const toast = useToast();
    
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [stats, setStats] = useState<any[]>([]);
    const [dailyStats, setDailyStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCourier, setEditingCourier] = useState<Courier | null>(null);
    const [formData, setFormData] = useState<Partial<Courier>>({
        name: '',
        phone: '',
        active: true,
        commissionType: 'NONE',
        commissionValue: 0
    });

    const loadData = async () => {
        setLoading(true);
        try {
            const [couriersData, statsData, dailyData] = await Promise.all([
                api<Courier[]>('/delivery-couriers/search?q='),
                api<any[]>('/delivery-couriers/stats'),
                api<any[]>('/delivery-couriers/stats/daily')
            ]);
            setCouriers(couriersData);
            setStats(statsData);
            setDailyStats(dailyData);
        } catch (err) {
            console.error('Failed to load couriers', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenModal = (courier?: Courier) => {
        if (courier) {
            setEditingCourier(courier);
            setFormData(courier);
        } else {
            setEditingCourier(null);
            setFormData({
                name: '',
                phone: '',
                active: true,
                commissionType: 'NONE',
                commissionValue: 0
            });
        }
        setShowModal(true);
    };

    const handleSubmit = async () => {
        try {
            if (editingCourier) {
                await api(`/delivery-couriers/${editingCourier.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(formData)
                });
            } else {
                await api('/delivery-couriers', {
                    method: 'POST',
                    body: JSON.stringify(formData)
                });
            }
            setShowModal(false);
            loadData();
        } catch (err: any) {
            toast.error(err.message || 'Error saving courier');
        }
    };

    const handlePayCommission = async (courierId: number) => {
        if (!window.confirm(t('delivery.settleConfirm'))) return;
        try {
            await api(`/delivery-couriers/${courierId}/pay-commission`, {
                method: 'POST',
                body: JSON.stringify({}) // Pays all earned
            });
            loadData();
        } catch (err: any) {
            toast.error(err.message || 'Error settling commission');
        }
    };

    const courierColumns = [
        { accessorKey: 'name', header: t('delivery.courierName') },
        { accessorKey: 'phone', header: t('delivery.phone') },
        { 
            accessorKey: 'commission', 
            header: t('delivery.commissionPolicy'),
            cell: (row: Courier) => (
                <span>
                    {t(`delivery.policy.${row.commissionType}`)} 
                    {row.commissionType !== 'NONE' && row.commissionType !== 'MANUAL' && `: ${row.commissionValue}${row.commissionType === 'PERCENT_OF_ORDER' ? '%' : ''}`}
                </span>
            )
        },
        { 
            header: t('common.status'),
            cell: (row: Courier) => (
                <StatusBadge 
                    variant={row.active ? 'success' : 'danger'}
                >
                    {row.active ? t('common.active') : t('common.inactive')}
                </StatusBadge>
            )
        },
        {
            accessorKey: 'actions',
            header: t('common.actions'),
            cell: (row: Courier) => (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" size="sm" onClick={() => handleOpenModal(row)}>
                        {t('common.edit')}
                    </Button>
                </div>
            )
        }
    ];

    const statsColumns = [
        { accessorKey: 'courier_name', header: t('delivery.courierName') },
        { accessorKey: 'total_orders', header: t('delivery.totalOrders') },
        { 
            accessorKey: 'total_sales', 
            header: t('delivery.totalSales'),
            cell: (row: any) => formatCurrency(row.total_sales)
        },
        { 
            accessorKey: 'total_earned', 
            header: t('delivery.earnedCommission'),
            cell: (row: any) => (
                <span className="text-success" style={{ fontWeight: 'bold' }}>
                    {formatCurrency(row.total_earned)}
                </span>
            )
        },
        { 
            accessorKey: 'total_paid', 
            header: t('delivery.paidCommission'),
            cell: (row: any) => formatCurrency(row.total_paid)
        },
        { 
            accessorKey: 'balance', 
            header: t('delivery.remainingBalance'),
            cell: (row: any) => {
                const balance = row.total_earned - row.total_paid;
                return (
                    <span style={{ color: balance > 0 ? 'var(--danger-color)' : 'inherit', fontWeight: 'bold' }}>
                        {formatCurrency(balance)}
                    </span>
                );
            }
        },
        {
            accessorKey: 'actions',
            header: t('common.actions'),
            cell: (row: any) => {
                const balance = row.total_earned - row.total_paid;
                return balance > 0 ? (
                    <Button variant="primary" size="sm" onClick={() => handlePayCommission(row.courier_id)}>
                        {t('delivery.settle')}
                    </Button>
                ) : null;
            }
        }
    ];
    const [activeTab, setActiveTab] = useState('couriers');

    return (
        <div className="delivery-couriers-page">
            <PageHeader 
                title={t('delivery.title')} 
                subtitle={t('delivery.subtitle')}
                actions={
                    <Button variant="primary" onClick={() => handleOpenModal()}>
                        {t('delivery.addCourier')}
                    </Button>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="stats-card">
                    <CardHeader><CardTitle>{t('delivery.activeCouriers')}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="stats-value">{couriers.filter(c => c.active).length}</div>
                    </CardContent>
                </Card>
                <Card className="stats-card">
                    <CardHeader><CardTitle>{t('delivery.dailyOrders')}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="stats-value">
                            {dailyStats.reduce((acc, curr) => acc + curr.total_orders, 0)}
                        </div>
                    </CardContent>
                </Card>
                <Card className="stats-card">
                    <CardHeader><CardTitle>{t('delivery.unpaidCommission')}</CardTitle></CardHeader>
                    <CardContent>
                        <div className="stats-value text-danger">
                            {formatCurrency(stats.reduce((acc, curr) => acc + (curr.total_earned - curr.total_paid), 0))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <Tabs 
                    tabs={[
                        { id: 'couriers', label: t('delivery.couriersList') },
                        { id: 'performance', label: t('delivery.performanceReport') }
                    ]}
                    defaultTab="couriers"
                    onTabChange={setActiveTab}
                />
                
                <div style={{ marginTop: '20px' }}>
                    {activeTab === 'couriers' && (
                        <Table 
                            columns={courierColumns as any} 
                            data={couriers} 
                            isLoading={loading}
                        />
                    )}
                    
                    {activeTab === 'performance' && (
                        <Table 
                            columns={statsColumns as any} 
                            data={stats} 
                            isLoading={loading}
                        />
                    )}
                </div>
            </Card>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingCourier ? t('delivery.editCourier') : t('delivery.addCourier')}
            >
                <div className="form-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
                    <Input 
                        label={t('delivery.courierName')}
                        value={formData.name}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        required
                    />
                    <Input 
                        label={t('delivery.phone')}
                        value={formData.phone}
                        onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                    
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <Select 
                                label={t('delivery.commissionType')}
                                value={formData.commissionType}
                                onChange={e => setFormData(prev => ({ ...prev, commissionType: e.target.value as any }))}
                            >
                                <option value="NONE">{t('delivery.policy.NONE')}</option>
                                <option value="FIXED_PER_ORDER">{t('delivery.policy.FIXED_PER_ORDER')}</option>
                                <option value="PERCENT_OF_ORDER">{t('delivery.policy.PERCENT_OF_ORDER')}</option>
                                <option value="MANUAL">{t('delivery.policy.MANUAL')}</option>
                            </Select>
                        </div>
                        {formData.commissionType !== 'NONE' && formData.commissionType !== 'MANUAL' && (
                            <div style={{ width: '120px' }}>
                                <Input 
                                    type="number"
                                    label={formData.commissionType === 'PERCENT_OF_ORDER' ? '%' : t('common.amount')}
                                    value={formData.commissionValue}
                                    onChange={e => setFormData(prev => ({ ...prev, commissionValue: Number(e.target.value) }))}
                                />
                            </div>
                        )}
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Switch 
                            checked={!!formData.active} 
                            onCheckedChange={checked => setFormData(prev => ({ ...prev, active: checked }))}
                        />
                        <span>{t('common.active')}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button variant="primary" onClick={handleSubmit}>
                            {t('common.save')}
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default DeliveryCouriersPage;

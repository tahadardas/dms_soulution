import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, DateRangePicker, StatusBadge, Table, Column } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../hooks/useCurrency';
import { formatDate, formatMoney, normalizeLocale } from '../utils/format';
import { 
    TrendingUp, 
    ShoppingCart, 
    ArrowUpRight, 
    Wallet, 
    AlertTriangle, 
    Calendar,
    ChevronRight,
    Zap
} from 'lucide-react';
import '../styles/DashboardPage.css';

interface DashboardStats {
    totalSales: number;
    totalCOGS: number;
    grossMargin: number;
    totalOrders: number;
    averageOrderValue: number;
    lowStockCount: number;
    cashOnHand: number;
    lowStockItems?: Array<{ id: number; name: string; stock_quantity: number; min_stock_level: number }>;
}

interface DailySale {
    date: string;
    revenue: number;
    id?: string;
}

const toRangeIso = (value: string, end: boolean) => {
    if (!value) return new Date().toISOString();
    const date = new Date(value);
    if (end) {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }
    return date.toISOString();
};

const KPICard: React.FC<{
    title: string;
    value: string;
    hint?: string;
    badgeText?: string;
    badgeVariant?: 'success' | 'warning' | 'danger' | 'info';
    actionLabel?: string;
    onAction?: () => void;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, hint, badgeText, badgeVariant = 'info', actionLabel, onAction, icon, trend }) => (
    <Card padding="lg" className={`dashboard-kpi dashboard-kpi--${badgeVariant}`}>
        <div className="dashboard-kpi__header">
            <div className="dashboard-kpi__icon-box">
                {icon}
            </div>
            {badgeText && (
                <StatusBadge variant={badgeVariant} size="sm" className="dashboard-kpi__badge">
                    {badgeText}
                </StatusBadge>
            )}
        </div>
        <div className="dashboard-kpi__content">
            <p className="dashboard-kpi__label">{title}</p>
            <p className="dashboard-kpi__value">{value}</p>
            {hint && (
                <div className="dashboard-kpi__footer">
                    <span className={`dashboard-kpi__trend dashboard-kpi__trend--${trend || 'neutral'}`}>
                        {trend === 'up' && <ArrowUpRight size={14} />}
                        {hint}
                    </span>
                </div>
            )}
        </div>
        {actionLabel && onAction && (
            <button className="dashboard-kpi__action" onClick={onAction}>
                {actionLabel}
                <ChevronRight size={14} className="flip-rtl" />
            </button>
        )}
    </Card>
);

export const DashboardPage: React.FC = () => {
    const api = useApi();
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [sales, setSales] = useState<DailySale[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [quickRange, setQuickRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [range, setRange] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return {
            startDate: start.toISOString().slice(0, 10),
            endDate: now.toISOString().slice(0, 10)
        };
    });

    const locale = useMemo(() => normalizeLocale(i18n.language), [i18n.language]);
    const currency = useCurrency();
    const formatCurrency = useCallback(
        (value: number) => formatMoney(value, currency, locale),
        [currency, locale]
    );
    const formatDateLabel = useCallback(
        (value: string) => formatDate(value, locale, { month: 'short', day: 'numeric' }),
        [locale]
    );

    const setRangeForQuick = (value: 'today' | 'week' | 'month') => {
        const now = new Date();
        if (value === 'today') {
            const today = now.toISOString().slice(0, 10);
            setRange({ startDate: today, endDate: today });
        } else if (value === 'week') {
            const start = new Date(now);
            start.setDate(now.getDate() - 6);
            setRange({ startDate: start.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) });
        } else {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            setRange({ startDate: start.toISOString().slice(0, 10), endDate: now.toISOString().slice(0, 10) });
        }
        setQuickRange(value);
    };

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const [statsData, dailySales] = await Promise.all([
                    api<DashboardStats>(
                        `/reports/dashboard?startDate=${toRangeIso(range.startDate, false)}&endDate=${toRangeIso(range.endDate, true)}`
                    ),
                    api<DailySale[]>(
                        `/reports/daily-sales?startDate=${toRangeIso(range.startDate, false)}&endDate=${toRangeIso(range.endDate, true)}`
                    )
                ]);
                setStats(statsData);
                setSales(dailySales);
            } catch (err: any) {
                setError(err?.message || t('errors.dashboard.loadFailed'));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [api, range, t]);

    const salesColumns: Column<DailySale>[] = useMemo(
        () => [
            { header: t('reports.dashboard.table.date'), accessorKey: 'date', cell: (row: DailySale) => formatDateLabel(row.date) },
            { header: t('reports.dashboard.table.revenue'), accessorKey: 'revenue', cell: (row: DailySale) => formatCurrency(row.revenue || 0) }
        ],
        [formatCurrency, formatDateLabel, t]
    );

    return (
        <div className="dashboard-v2">
            <div className="dashboard-hero">
                <div className="dashboard-hero__content">
                    <div className="hero-badge">{t('common.welcomeBack')}</div>
                    <h1>{t('nav.routes.dashboard.title')}</h1>
                    <p>{t('nav.routes.dashboard.subtitle')}</p>
                </div>
                <div className="dashboard-hero__actions">
                    <div className="premium-filter-group">
                        <Button
                            variant={quickRange === 'today' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setRangeForQuick('today')}
                        >
                            {t('reports.dashboard.quick.today')}
                        </Button>
                        <Button
                            variant={quickRange === 'week' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setRangeForQuick('week')}
                        >
                            {t('reports.dashboard.quick.week')}
                        </Button>
                        <Button
                            variant={quickRange === 'month' ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={() => setRangeForQuick('month')}
                        >
                            {t('reports.dashboard.quick.month')}
                        </Button>
                    </div>
                    <div className="premium-datepicker-wrapper">
                        <Calendar size={16} className="datepicker-icon" />
                        <DateRangePicker
                            value={range}
                            onChange={(next) => {
                                setRange(next);
                                setQuickRange('custom');
                            }}
                            startLabel={t('common.startDate')}
                            endLabel={t('common.endDate')}
                            separatorLabel="-"
                        />
                    </div>
                </div>
            </div>

            {error && <div className="dashboard-error-v2"><AlertTriangle /> {error}</div>}

            <div className="dashboard-grid-v2">
                <KPICard
                    title={t('reports.dashboard.kpis.sales')}
                    value={stats ? formatCurrency(stats.totalSales) : '...'}
                    hint={t('reports.dashboard.kpiHints.postedRevenue')}
                    icon={<TrendingUp size={24} />}
                    badgeText={t(`reports.dashboard.kpiBadges.${quickRange}`)}
                    badgeVariant="info"
                    trend="up"
                    actionLabel={t('reports.dashboard.actions.viewSales')}
                    onAction={() => navigate('/reports/sales')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.grossMargin')}
                    value={stats ? formatCurrency(stats.grossMargin) : '...'}
                    hint={stats ? t('reports.dashboard.kpiHints.marginRate', { value: ((stats.grossMargin / (stats.totalSales || 1)) * 100).toFixed(1) }) : undefined}
                    icon={<ArrowUpRight size={24} />}
                    badgeText={stats ? `${((stats.grossMargin / (stats.totalSales || 1)) * 100).toFixed(1)}%` : '...'}
                    badgeVariant={stats && stats.grossMargin >= 0 ? 'success' : 'danger'}
                    trend={stats && stats.grossMargin >= 0 ? 'up' : 'down'}
                    actionLabel={t('reports.dashboard.actions.viewMargins')}
                    onAction={() => navigate('/reports/margins')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.orders')}
                    value={stats ? stats.totalOrders.toString() : '...'}
                    hint={stats ? t('reports.dashboard.kpiHints.avgOrderValue', { value: formatCurrency(stats.averageOrderValue) }) : undefined}
                    icon={<ShoppingCart size={24} />}
                    badgeText={t('reports.dashboard.kpiBadges.tickets')}
                    badgeVariant="info"
                    actionLabel={t('reports.dashboard.actions.viewSessions')}
                    onAction={() => navigate('/reports/sessions-z')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.cashOnHand')}
                    value={stats ? formatCurrency(stats.cashOnHand) : '...'}
                    hint={t('reports.dashboard.kpiHints.openSessionsCash')}
                    icon={<Wallet size={24} />}
                    badgeText={t('reports.dashboard.kpiBadges.live')}
                    badgeVariant="success"
                    actionLabel={t('reports.dashboard.actions.viewSessions')}
                    onAction={() => navigate('/reports/sessions-z')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.lowStock')}
                    value={stats ? stats.lowStockCount.toString() : '...'}
                    hint={t('reports.dashboard.kpiHints.itemsNeedingRestock')}
                    icon={<AlertTriangle size={24} />}
                    badgeText={stats?.lowStockCount ? t('reports.dashboard.kpiBadges.critical') : t('reports.dashboard.kpiBadges.healthy')}
                    badgeVariant={stats?.lowStockCount ? 'danger' : 'success'}
                    actionLabel={t('reports.dashboard.actions.viewInventory')}
                    onAction={() => navigate('/inventory')}
                />
            </div>

            <div className="dashboard-lower-grid">
                <Card className="glass-card main-chart-card">
                    <CardHeader>
                        <CardTitle className="with-icon">
                            <TrendingUp size={18} /> {t('reports.dashboard.dailySales')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table data={sales} columns={salesColumns} isLoading={loading} />
                    </CardContent>
                </Card>

                <div className="side-cards">
                    <Card className="glass-card status-card">
                        <CardHeader>
                            <CardTitle className="with-icon">
                                <AlertTriangle size={18} /> {t('reports.dashboard.alerts.title')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="premium-alerts">
                                {stats?.lowStockCount ? (
                                    stats.lowStockItems?.slice(0, 5).map((item) => (
                                        <div key={item.id} className="premium-alert-item warning">
                                            <div className="alert-dot" />
                                            <div className="alert-content">
                                                <p className="alert-title">{item.name}</p>
                                                <p className="alert-desc">{t('reports.dashboard.alerts.lowStockItemShort', { current: item.stock_quantity, min: item.min_stock_level })}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="premium-alert-item success">
                                        <div className="alert-dot" />
                                        <p className="alert-title">{t('reports.dashboard.alerts.noCritical')}</p>
                                    </div>
                                )}
                            </div>
                            <Button variant="ghost" size="sm" className="full-width-btn" onClick={() => navigate('/inventory')}>
                                {t('reports.dashboard.actions.viewInventory')}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="premium-quick-actions">
                        <div className="quick-actions-grid">
                            <button className="qa-btn" onClick={() => navigate('/pos')}>
                                <Zap size={20} />
                                <span>{t('nav.routes.pos.title')}</span>
                            </button>
                            <button className="qa-btn" onClick={() => navigate('/products/new')}>
                                <ShoppingCart size={20} />
                                <span>{t('nav.routes.products.title')}</span>
                            </button>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;


import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, DateRangePicker, PageHeader, StatusBadge, Table, Column } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useApi } from '../hooks/useApi';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../hooks/useCurrency';
import { formatDate, formatMoney, normalizeLocale } from '../utils/format';
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
}> = ({ title, value, hint, badgeText, badgeVariant = 'info', actionLabel, onAction }) => (
    <Card padding="lg" className="dashboard-kpi">
        <div className="dashboard-kpi__header">
            <p className="dashboard-kpi__label">{title}</p>
            {badgeText && (
                <StatusBadge variant={badgeVariant} size="sm">
                    {badgeText}
                </StatusBadge>
            )}
        </div>
        <p className="dashboard-kpi__value">{value}</p>
        {hint && <p className="dashboard-kpi__change dashboard-kpi__change--neutral">{hint}</p>}
        {actionLabel && onAction && (
            <Button variant="ghost" size="sm" onClick={onAction}>
                {actionLabel}
            </Button>
        )}
    </Card>
);

const AlertItem: React.FC<{ title: string; type: 'warning' | 'danger' | 'info' | 'success'; badgeLabel: string }> = ({ title, type, badgeLabel }) => (
    <div className="dashboard-alert">
        <StatusBadge variant={type} size="sm">
            {badgeLabel}
        </StatusBadge>
        <span className="dashboard-alert__text">{title}</span>
    </div>
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
        <div className="dashboard">
            <PageHeader
                title={t('nav.routes.dashboard.title')}
                subtitle={t('nav.routes.dashboard.subtitle')}
                backButton={<BackButton />}
                actions={
                    <div className="dashboard-header__actions">
                        <div className="dashboard-quick-filters">
                            <Button
                                variant={quickRange === 'today' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setRangeForQuick('today')}
                            >
                                {t('reports.dashboard.quick.today')}
                            </Button>
                            <Button
                                variant={quickRange === 'week' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setRangeForQuick('week')}
                            >
                                {t('reports.dashboard.quick.week')}
                            </Button>
                            <Button
                                variant={quickRange === 'month' ? 'primary' : 'secondary'}
                                size="sm"
                                onClick={() => setRangeForQuick('month')}
                            >
                                {t('reports.dashboard.quick.month')}
                            </Button>
                        </div>
                        <DateRangePicker
                            value={range}
                            onChange={(next) => {
                                setRange(next);
                                setQuickRange('custom');
                            }}
                            startLabel={t('common.startDate')}
                            endLabel={t('common.endDate')}
                            separatorLabel={t('common.to')}
                        />
                    </div>
                }
            />

            {error && <div className="dashboard-error">{error}</div>}
            {loading && <div className="dashboard-loading">{t('reports.dashboard.loading')}</div>}

            <div className="dashboard-kpi-grid">
                <KPICard
                    title={t('reports.dashboard.kpis.sales')}
                    value={stats ? formatCurrency(stats.totalSales) : t('common.placeholder')}
                    hint={t('reports.dashboard.kpiHints.postedRevenue')}
                    badgeText={
                        quickRange === 'today'
                            ? t('reports.dashboard.kpiBadges.today')
                            : quickRange === 'week'
                                ? t('reports.dashboard.kpiBadges.week')
                                : quickRange === 'month'
                                    ? t('reports.dashboard.kpiBadges.month')
                                    : t('reports.dashboard.kpiBadges.custom')
                    }
                    badgeVariant="info"
                    actionLabel={t('reports.dashboard.actions.viewSales')}
                    onAction={() => navigate('/reports/sales')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.grossMargin')}
                    value={stats ? formatCurrency(stats.grossMargin) : t('common.placeholder')}
                    hint={stats ? t('reports.dashboard.kpiHints.marginRate', { value: ((stats.grossMargin / (stats.totalSales || 1)) * 100).toFixed(1) }) : undefined}
                    badgeText={stats ? `${((stats.grossMargin / (stats.totalSales || 1)) * 100).toFixed(1)}%` : t('common.placeholder')}
                    badgeVariant={stats && stats.grossMargin >= 0 ? 'success' : 'danger'}
                    actionLabel={t('reports.dashboard.actions.viewMargins')}
                    onAction={() => navigate('/reports/margins')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.orders')}
                    value={stats ? stats.totalOrders.toString() : t('common.placeholder')}
                    hint={stats ? t('reports.dashboard.kpiHints.avgOrderValue', { value: formatCurrency(stats.averageOrderValue) }) : undefined}
                    badgeText={t('reports.dashboard.kpiBadges.tickets')}
                    badgeVariant="info"
                    actionLabel={t('reports.dashboard.actions.viewSessions')}
                    onAction={() => navigate('/reports/sessions-z')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.avgTicket')}
                    value={stats ? formatCurrency(stats.averageOrderValue) : t('common.placeholder')}
                    hint={t('reports.dashboard.kpiHints.avgOrder')}
                    badgeText={t('reports.dashboard.kpiBadges.perOrder')}
                    badgeVariant="info"
                    actionLabel={t('reports.dashboard.actions.viewSales')}
                    onAction={() => navigate('/reports/sales')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.cashOnHand')}
                    value={stats ? formatCurrency(stats.cashOnHand) : t('common.placeholder')}
                    hint={t('reports.dashboard.kpiHints.openSessionsCash')}
                    badgeText={t('reports.dashboard.kpiBadges.live')}
                    badgeVariant="success"
                    actionLabel={t('reports.dashboard.actions.viewSessions')}
                    onAction={() => navigate('/reports/sessions-z')}
                />
                <KPICard
                    title={t('reports.dashboard.kpis.lowStock')}
                    value={stats ? stats.lowStockCount.toString() : t('common.placeholder')}
                    hint={t('reports.dashboard.kpiHints.itemsBelowMin')}
                    badgeText={stats?.lowStockCount ? t('reports.dashboard.kpiBadges.action') : t('reports.dashboard.kpiBadges.clear')}
                    badgeVariant={stats?.lowStockCount ? 'warning' : 'success'}
                    actionLabel={t('reports.dashboard.actions.viewInventory')}
                    onAction={() => navigate('/inventory')}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.dashboard.alerts.title')}</CardTitle>
                    <StatusBadge variant={stats?.lowStockCount ? 'warning' : 'success'} size="sm">
                        {stats?.lowStockCount ? t('reports.dashboard.alerts.lowStock', { count: stats.lowStockCount }) : t('reports.dashboard.alerts.allClear')}
                    </StatusBadge>
                </CardHeader>
                <CardContent>
                    {stats?.lowStockCount ? (
                        <>
                            {(stats.lowStockItems || []).map((item) => (
                                <AlertItem
                                    key={item.id}
                                    type="warning"
                                    badgeLabel={t('reports.dashboard.alerts.badge.warning')}
                                    title={t('reports.dashboard.alerts.lowStockItem', {
                                        name: item.name,
                                        current: item.stock_quantity,
                                        min: item.min_stock_level
                                    })}
                                />
                            ))}
                            {(stats.lowStockItems || []).length === 0 && (
                                <AlertItem
                                    type="warning"
                                    badgeLabel={t('reports.dashboard.alerts.badge.warning')}
                                    title={t('reports.dashboard.alerts.lowStockFallback')}
                                />
                            )}
                        </>
                    ) : (
                        <AlertItem
                            type="success"
                            badgeLabel={t('reports.dashboard.alerts.badge.success')}
                            title={t('reports.dashboard.alerts.noCritical')}
                        />
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('reports.dashboard.dailySales')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table data={sales} columns={salesColumns} isLoading={loading} />
                </CardContent>
            </Card>
        </div>
    );
};

export default DashboardPage;

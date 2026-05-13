import React, { useMemo } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, PageHeader } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '../components/BackButton';
import { useCan } from '../hooks/useCan';
import { PERMISSIONS } from '../lib/permissions';
import { useTranslation } from 'react-i18next';
import '../styles/ReportsPage.css';

interface ReportCard {
    id: string;
    title: string;
    description: string;
    path: string;
}

export const ReportsPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    const canViewReports = useCan(undefined, [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS]);

    const reportCards = useMemo<ReportCard[]>(
        () => [
            {
                id: 'sales',
                title: t('reports.hub.cards.sales.title'),
                description: t('reports.hub.cards.sales.description'),
                path: '/reports/sales'
            },
            {
                id: 'sessions',
                title: t('reports.hub.cards.sessionsZ.title'),
                description: t('reports.hub.cards.sessionsZ.description'),
                path: '/reports/sessions-z'
            },
            {
                id: 'inventory',
                title: t('reports.hub.cards.inventory.title'),
                description: t('reports.hub.cards.inventory.description'),
                path: '/reports/inventory'
            },
            {
                id: 'margins',
                title: t('reports.hub.cards.margins.title'),
                description: t('reports.hub.cards.margins.description'),
                path: '/reports/margins'
            },
            {
                id: 'trial-balance',
                title: t('reports.hub.cards.trialBalance.title'),
                description: t('reports.hub.cards.trialBalance.description'),
                path: '/reports/trial-balance'
            }
        ],
        [t]
    );

    return (
        <div className="reports-page">
            <PageHeader
                title={t('reports.hub.title')}
                subtitle={t('reports.hub.subtitle')}
                backButton={<BackButton />}
            />

            <div className="reports-page__grid">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('reports.hub.overviewTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="reports-page__summary">
                            <div className="reports-page__summary-item">
                                <span className="reports-page__summary-label">{t('reports.hub.summary.availableLabel')}</span>
                                <span className="reports-page__summary-value">{reportCards.length}</span>
                                <span className="reports-page__summary-hint">{t('reports.hub.summary.availableHint')}</span>
                            </div>
                            <div className="reports-page__summary-item">
                                <span className="reports-page__summary-label">{t('reports.hub.summary.accessLabel')}</span>
                                <span className="reports-page__summary-value">
                                    {canViewReports ? t('reports.hub.summary.accessEnabled') : t('reports.hub.summary.accessRestricted')}
                                </span>
                                <span className="reports-page__summary-hint">{t('reports.hub.summary.accessHint')}</span>
                            </div>
                            <div className="reports-page__summary-item">
                                <span className="reports-page__summary-label">{t('reports.hub.summary.tipLabel')}</span>
                                <span className="reports-page__summary-value">{t('reports.hub.summary.tipValue')}</span>
                                <span className="reports-page__summary-hint">{t('reports.hub.summary.tipHint')}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('reports.hub.libraryTitle')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {!canViewReports && (
                            <div className="reports-page__empty">
                                <div className="reports-page__empty-title">{t('reports.hub.noAccessTitle')}</div>
                                <div className="reports-page__empty-description">{t('reports.hub.noAccessDescription')}</div>
                            </div>
                        )}
                        {canViewReports && (
                            <div className="reports-page__cards">
                                {reportCards.map((report) => (
                                    <div key={report.id} className="reports-page__card">
                                        <div>
                                            <div className="reports-page__card-title">{report.title}</div>
                                            <div className="reports-page__card-description">{report.description}</div>
                                        </div>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => navigate(report.path)}
                                        >
                                            {t('reports.hub.actions.openReport')}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ReportsPage;

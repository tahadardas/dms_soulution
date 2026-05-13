import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, PageHeader } from '@dms/ui';
import { BackButton } from './BackButton';
import { useTranslation } from 'react-i18next';
import '../styles/StandardPage.css';

export type PageStatus = 'loading' | 'error' | 'empty' | 'ready';

export interface SummaryItem {
    label: string;
    value: string;
    hint?: string;
}

export interface StandardPageProps {
    title: string;
    subtitle: string;
    actions?: React.ReactNode;
    status?: PageStatus;
    errorTitle?: string;
    errorMessage?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    emptyAction?: React.ReactNode;
    summaryTitle?: string;
    summaryItems?: SummaryItem[];
    contentTitle?: string;
    contentDescription?: string;
    showBackButton?: boolean;
    children?: React.ReactNode;
}

export const StandardPage: React.FC<StandardPageProps> = ({
    title,
    subtitle,
    actions,
    status = 'empty',
    errorTitle,
    errorMessage,
    emptyTitle,
    emptyDescription,
    emptyAction,
    summaryTitle,
    summaryItems,
    contentTitle,
    contentDescription,
    showBackButton = true,
    children
}) => {
    const { t } = useTranslation();
    const items = summaryItems && summaryItems.length > 0 ? summaryItems : [
        {
            label: t('common.standardPage.fallbackStatusLabel'),
            value: t('common.standardPage.fallbackStatusValue'),
            hint: t('common.standardPage.fallbackStatusHint')
        },
        {
            label: t('common.standardPage.fallbackUpdateLabel'),
            value: t('common.standardPage.fallbackUpdateValue'),
            hint: t('common.standardPage.fallbackUpdateHint')
        },
        {
            label: t('common.standardPage.fallbackOwnerLabel'),
            value: t('common.standardPage.fallbackOwnerValue'),
            hint: t('common.standardPage.fallbackOwnerHint')
        }
    ];
    const resolvedErrorTitle = errorTitle || t('common.standardPage.errorTitle');
    const resolvedErrorMessage = errorMessage || t('common.standardPage.errorMessage');
    const resolvedEmptyTitle = emptyTitle || t('common.standardPage.emptyTitle');
    const resolvedEmptyDescription = emptyDescription || t('common.standardPage.emptyDescription');
    const resolvedSummaryTitle = summaryTitle || t('common.standardPage.summaryTitle');
    const resolvedContentTitle = contentTitle || t('common.standardPage.contentTitle');

    return (
        <div className="standard-page">
            <PageHeader
                title={title}
                subtitle={subtitle}
                backButton={showBackButton ? <BackButton /> : undefined}
                actions={actions}
            />

            <div className="standard-page__grid">
                <Card>
                    <CardHeader>
                        <CardTitle>{resolvedSummaryTitle}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="standard-page__summary">
                            {items.map((item) => (
                                <div key={item.label} className="standard-page__summary-item">
                                    <span className="standard-page__summary-label">{item.label}</span>
                                    <span className="standard-page__summary-value">{item.value}</span>
                                    {item.hint && <span className="standard-page__summary-hint">{item.hint}</span>}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{resolvedContentTitle}</CardTitle>
                        {contentDescription && (
                            <p className="standard-page__card-subtitle">{contentDescription}</p>
                        )}
                    </CardHeader>
                    <CardContent>
                        {status === 'loading' && (
                            <div className="page-state page-state--loading">
                                <span className="page-state__title">{t('common.standardPage.loadingTitle')}</span>
                                <span className="page-state__description">{t('common.standardPage.loadingDescription')}</span>
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="page-state page-state--error">
                                <span className="page-state__title">{resolvedErrorTitle}</span>
                                <span className="page-state__description">{resolvedErrorMessage}</span>
                            </div>
                        )}
                        {status === 'empty' && (
                            <div className="page-state page-state--empty">
                                <span className="page-state__title">{resolvedEmptyTitle}</span>
                                <span className="page-state__description">{resolvedEmptyDescription}</span>
                                {emptyAction && <div className="page-state__action">{emptyAction}</div>}
                            </div>
                        )}
                        {status === 'ready' && (children || (
                            <div className="page-state page-state--ready">
                                <span className="page-state__title">{t('common.standardPage.readyTitle')}</span>
                                <span className="page-state__description">{t('common.standardPage.readyDescription')}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default StandardPage;

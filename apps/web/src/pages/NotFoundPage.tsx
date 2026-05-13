import React from 'react';
import { Button } from '@dms/ui';
import { useLocation, useNavigate } from 'react-router-dom';
import StandardPage, { PageStatus } from '../components/StandardPage';
import { useAuth } from '../context/AuthContext';
import { getFallbackPathForRole } from '../routes';
import { useTranslation } from 'react-i18next';

export const NotFoundPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { t } = useTranslation();
    const fallbackPath = user ? getFallbackPathForRole(user.role) : '/login';
    const status: PageStatus = 'empty';

    return (
        <StandardPage
            title={t('errors.notFound.title')}
            subtitle={t('errors.notFound.subtitle')}
            status={status}
            actions={(
                <Button variant="secondary" onClick={() => navigate(fallbackPath)}>
                    {t('errors.notFound.goHome')}
                </Button>
            )}
            summaryTitle={t('errors.notFound.summaryTitle')}
            summaryItems={[
                { label: t('errors.notFound.summary.errorCode'), value: '404', hint: t('errors.notFound.summary.errorHint') },
                { label: t('errors.notFound.summary.path'), value: location.pathname || t('common.placeholder'), hint: t('errors.notFound.summary.pathHint') },
                { label: t('errors.notFound.summary.suggested'), value: fallbackPath, hint: t('errors.notFound.summary.suggestedHint') }
            ]}
            contentTitle={t('errors.notFound.contentTitle')}
            contentDescription={t('errors.notFound.contentDescription')}
            emptyTitle={t('errors.notFound.emptyTitle')}
            emptyDescription={t('errors.notFound.emptyDescription')}
            emptyAction={(
                <Button variant="primary" onClick={() => navigate(fallbackPath)}>
                    {t('errors.notFound.returnHome')}
                </Button>
            )}
        />
    );
};

export default NotFoundPage;

import React from 'react';
import { useTranslation } from 'react-i18next';
import TrialBalancePage from './TrialBalancePage';

export const ReportsTrialBalancePage: React.FC = () => {
    const { t } = useTranslation();
    return (
        <TrialBalancePage
            title={t('reports.trialBalance.title')}
            subtitle={t('reports.trialBalance.subtitle')}
            showBackButton={true}
        />
    );
};

export default ReportsTrialBalancePage;

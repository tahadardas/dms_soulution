import React from 'react';
import { Button } from '@dms/ui';
import { useNavigate } from 'react-router-dom';
import StandardPage from '../components/StandardPage';
import { useAuth } from '../context/AuthContext';
import { getFallbackPathForRole } from '../routes';
import { PermissionCode } from '../lib/permissions';
import { useTranslation } from 'react-i18next';

export interface NoAccessPageProps {
    requiredPermissions?: PermissionCode[];
}

export const NoAccessPage: React.FC<NoAccessPageProps> = ({ requiredPermissions }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { t } = useTranslation();
    const fallbackPath = getFallbackPathForRole(user?.role);
    const permissionsText = requiredPermissions && requiredPermissions.length > 0
        ? t('errors.noAccess.requiredPermissions', { perms: requiredPermissions.join(', ') })
        : t('errors.noAccess.contactAdmin');

    return (
        <StandardPage
            title={t('errors.noAccess.title')}
            subtitle={t('errors.noAccess.subtitle')}
            status="error"
            errorTitle={t('errors.noAccess.errorTitle')}
            errorMessage={permissionsText}
            actions={(
                <Button variant="secondary" onClick={() => navigate(fallbackPath)}>
                    {t('errors.noAccess.goHome')}
                </Button>
            )}
            summaryTitle={t('errors.noAccess.summaryTitle')}
            summaryItems={[
                { label: t('errors.noAccess.summary.role'), value: user?.role || t('errors.noAccess.unknownRole'), hint: t('errors.noAccess.summary.roleHint') },
                { label: t('errors.noAccess.summary.requiredPerms'), value: `${requiredPermissions?.length || 0}`, hint: t('errors.noAccess.summary.requiredPermsHint') },
                { label: t('errors.noAccess.summary.destination'), value: fallbackPath, hint: t('errors.noAccess.summary.destinationHint') }
            ]}
            contentTitle={t('errors.noAccess.contentTitle')}
            contentDescription={t('errors.noAccess.contentDescription')}
        />
    );
};

export default NoAccessPage;

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@dms/ui';
import { apiFetch } from '../lib/api';
import { useAppConfig } from '../context/AppConfigContext';
import { useAuth } from '../context/AuthContext';

export const useApi = () => {
    const { apiUrl } = useAppConfig();
    const { accessToken, refreshSession } = useAuth();
    const { error: toastError } = useToast();
    const { t } = useTranslation();

    return useCallback(
        async <T>(path: string, options: RequestInit = {}) => {
            try {
                return await apiFetch<T>(apiUrl, path, options, accessToken);
            } catch (err: any) {
                const status = err?.status;
                const isAuthPath = path.startsWith('/auth/');

                if (status === 401 && !isAuthPath) {
                    try {
                        const newToken = await refreshSession();
                        if (newToken) {
                            return await apiFetch<T>(apiUrl, path, options, newToken);
                        }
                    } catch (refreshErr) {
                        // Refresh failed, user likely logged out or session expired
                        toastError(t('errors.api.sessionExpired'));
                        throw refreshErr;
                    }
                }

                if (status === 403) {
                    toastError(t('errors.api.forbidden'));
                } else if (status >= 500) {
                    toastError(t('errors.api.serverError'));
                } else if (!isAuthPath) {
                    // Show specific error message from server if available
                    const msg = err?.data?.message || err?.message || t('errors.api.generic');
                    toastError(msg);
                }

                throw err;
            }
        },
        [apiUrl, accessToken, refreshSession, toastError, t]
    );
};

import { useCallback } from 'react';
import { apiFetch } from '../lib/api';
import { useAppConfig } from '../context/AppConfigContext';
import { useAuth } from '../context/AuthContext';

export const useApi = () => {
    const { apiUrl } = useAppConfig();
    const { accessToken, refreshSession } = useAuth();

    return useCallback(
        async <T>(path: string, options: RequestInit = {}) => {
            try {
                return await apiFetch<T>(apiUrl, path, options, accessToken);
            } catch (err: any) {
                const status = err?.status;
                const isAuthPath = path.startsWith('/auth/');
                if (status === 401 && !isAuthPath) {
                    const newToken = await refreshSession();
                    if (newToken) {
                        return apiFetch<T>(apiUrl, path, options, newToken);
                    }
                }
                throw err;
            }
        },
        [apiUrl, accessToken, refreshSession]
    );
};

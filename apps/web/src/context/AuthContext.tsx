import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { useAppConfig } from './AppConfigContext';
import i18n from '../i18n';

export interface AuthUser {
    id: number;
    username: string;
    role: string;
    branch_id?: number | null;
    settings?: {
        language?: string;
    };
}

interface AuthContextValue {
    user: AuthUser | null;
    accessToken: string | null;
    refreshToken: string | null;
    permissions: string[];
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    refreshSession: () => Promise<string | null>;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
    updateUserSettings: (settings: Partial<AuthUser['settings']>) => Promise<AuthUser['settings'] | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'dms-auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { apiUrl } = useAppConfig();
    const [user, setUser] = useState<AuthUser | null>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        try {
            const parsed = JSON.parse(stored);
            return parsed.user || null;
        } catch {
            return null;
        }
    });
    const [accessToken, setAccessToken] = useState<string | null>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        try {
            const parsed = JSON.parse(stored);
            return parsed.accessToken || null;
        } catch {
            return null;
        }
    });
    const [refreshToken, setRefreshToken] = useState<string | null>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return null;
        try {
            const parsed = JSON.parse(stored);
            return parsed.refreshToken || null;
        } catch {
            return null;
        }
    });
    const [permissions, setPermissions] = useState<string[]>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return [];
        try {
            const parsed = JSON.parse(stored);
            return parsed.permissions || [];
        } catch {
            return [];
        }
    });
    const [isLoading, setIsLoading] = useState(false);

    const persistAuth = (payload: { user: AuthUser; accessToken: string; refreshToken: string; permissions: string[] }) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setUser(payload.user);
        setAccessToken(payload.accessToken);
        setRefreshToken(payload.refreshToken);
        setPermissions(payload.permissions || []);
    };

    const updateStoredUser = (nextUser: AuthUser | null) => {
        const payload = {
            user: nextUser,
            accessToken,
            refreshToken,
            permissions
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        setUser(nextUser);
    };

    const login = async (username: string, password: string) => {
        setIsLoading(true);
        try {
            const data = await apiFetch<{
                user: AuthUser;
                accessToken: string;
                refreshToken: string;
                permissions: string[];
            }>(apiUrl, '/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            persistAuth({
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                permissions: data.permissions || []
            });
        } finally {
            setIsLoading(false);
        }
    };

    const refreshSession = async () => {
        if (!refreshToken) {
            logout();
            return null;
        }
        setIsLoading(true);
        try {
            const data = await apiFetch<{
                user: AuthUser;
                accessToken: string;
                refreshToken: string;
                permissions: string[];
            }>(apiUrl, '/auth/refresh', {
                method: 'POST',
                body: JSON.stringify({ refreshToken })
            });
            persistAuth({
                user: data.user,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                permissions: data.permissions || []
            });
            return data.accessToken;
        } catch {
            logout();
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const updateUserSettings = async (settings: Partial<AuthUser['settings']>) => {
        if (!accessToken || !user) return null;
        const nextSettings = await apiFetch<AuthUser['settings']>(
            apiUrl,
            '/users/me/settings',
            {
                method: 'PUT',
                body: JSON.stringify(settings || {})
            },
            accessToken
        );
        updateStoredUser({
            ...user,
            settings: {
                ...(user.settings || {}),
                ...(nextSettings || {})
            }
        });
        return nextSettings || null;
    };

    const logout = () => {
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setAccessToken(null);
        setRefreshToken(null);
        setPermissions([]);
    };

    const hasPermission = (permission: string) => {
        if (!permission) return true;
        if (user?.role === 'admin') return true;
        return permissions.includes(permission);
    };

    useEffect(() => {
        const desiredLanguage = user?.settings?.language;
        if (desiredLanguage && desiredLanguage !== i18n.language) {
            i18n.changeLanguage(desiredLanguage);
        }
    }, [user?.settings?.language]);

    useEffect(() => {
        if (!window.electronAPI?.startPrintJobPolling) return;

        if (!accessToken || !user) {
            window.electronAPI.stopPrintJobPolling?.();
            return;
        }

        window.electronAPI.startPrintJobPolling({
            apiUrl,
            accessToken,
            intervalMs: 3000,
            branchId: user.branch_id ?? null,
            deviceName: `DMS ${user.username}`
        }).catch((error) => {
            console.error('Failed to start desktop print polling:', error);
        });

        return () => {
            window.electronAPI?.stopPrintJobPolling?.();
        };
    }, [accessToken, apiUrl, user?.branch_id, user?.id, user?.username]);

    const value = useMemo(() => ({
        user,
        accessToken,
        refreshToken,
        permissions,
        isLoading,
        login,
        refreshSession,
        logout,
        hasPermission,
        updateUserSettings
    }), [user, accessToken, refreshToken, permissions, isLoading, refreshSession, login, logout, hasPermission, updateUserSettings]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

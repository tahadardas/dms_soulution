import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeApiBase } from '../lib/api';

interface AppConfig {
    apiUrl: string;
    kioskMode: boolean;
}

interface AppConfigContextValue extends AppConfig {
    setApiUrl: (url: string) => void;
    setKioskMode: (enabled: boolean) => void;
    saveConfig: (next: AppConfig) => Promise<void>;
    isLoading: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
    apiUrl: 'http://127.0.0.1:4780',
    kioskMode: false
};

const AppConfigContext = createContext<AppConfigContextValue | undefined>(undefined);

const STORAGE_KEY = 'dms-app-config';

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                if ((window as any).electronAPI?.getConfig) {
                    const stored = await (window as any).electronAPI.getConfig();
                    setConfig({
                        apiUrl: normalizeApiBase(stored?.apiUrl || DEFAULT_CONFIG.apiUrl),
                        kioskMode: Boolean(stored?.kioskMode)
                    });
                } else {
                    const stored = localStorage.getItem(STORAGE_KEY);
                    if (stored) {
                        const parsed = JSON.parse(stored) as Partial<AppConfig>;
                        setConfig({
                            apiUrl: normalizeApiBase(parsed.apiUrl || DEFAULT_CONFIG.apiUrl),
                            kioskMode: Boolean(parsed.kioskMode)
                        });
                    }
                }
            } catch {
                setConfig(DEFAULT_CONFIG);
            } finally {
                setIsLoading(false);
            }
        };

        loadConfig();
    }, []);

    useEffect(() => {
        const api = (window as any).electronAPI;
        if (!api?.onConfigUpdated) return;
        const unsubscribe = api.onConfigUpdated((next: Partial<AppConfig>) => {
            setConfig({
                apiUrl: normalizeApiBase(next?.apiUrl || DEFAULT_CONFIG.apiUrl),
                kioskMode: Boolean(next?.kioskMode)
            });
        });
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    const saveConfig = async (next: AppConfig) => {
        const normalized = {
            apiUrl: normalizeApiBase(next.apiUrl),
            kioskMode: Boolean(next.kioskMode)
        };
        setConfig(normalized);

        if ((window as any).electronAPI?.saveConfig) {
            await (window as any).electronAPI.saveConfig(normalized);
        } else {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
        }
    };

    const value = useMemo(() => ({
        apiUrl: config.apiUrl,
        kioskMode: config.kioskMode,
        setApiUrl: (url: string) => setConfig(prev => ({ ...prev, apiUrl: normalizeApiBase(url) })),
        setKioskMode: (enabled: boolean) => setConfig(prev => ({ ...prev, kioskMode: enabled })),
        saveConfig,
        isLoading
    }), [config, isLoading]);

    return (
        <AppConfigContext.Provider value={value}>
            {children}
        </AppConfigContext.Provider>
    );
};

export const useAppConfig = () => {
    const context = useContext(AppConfigContext);
    if (!context) {
        throw new Error('useAppConfig must be used within AppConfigProvider');
    }
    return context;
};

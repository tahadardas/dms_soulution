import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../../hooks/useApi';

export const POSStatusBar: React.FC = () => {
    const { t } = useTranslation();
    const api = useApi();
    const [apiOnline, setApiOnline] = useState<boolean | null>(null);
    const [workstation, setWorkstation] = useState<{ deviceKey: string; isPolling: boolean } | null>(null);
    const [failedJobs, setFailedJobs] = useState(0);

    const checkStatus = async () => {
        try {
            // Check API
            await api('/health');
            setApiOnline(true);

            // Check Print Agent if in Electron
            if ((window as any).electronAPI?.getPollingStatus) {
                const status = await (window as any).electronAPI.getPollingStatus();
                setWorkstation({
                    deviceKey: status.deviceKey,
                    isPolling: status.isPolling
                });
            }

            // Check failed jobs
            const jobs = await api<{ total: number }>('/printing/jobs?status=FAILED&pageSize=1');
            setFailedJobs(jobs.total || 0);
        } catch {
            setApiOnline(false);
        }
    };

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 10000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="pos-status-bar">
            <div className="pos-status-bar__item">
                <span className={`pos-status-indicator ${apiOnline ? 'is-online' : 'is-offline'}`} />
                {apiOnline ? t('nav.topbar.apiOnline', 'API Online') : t('nav.topbar.apiOffline', 'API Offline')}
            </div>

            {workstation && (
                <div className="pos-status-bar__item">
                    <span className={`pos-status-indicator ${workstation.isPolling ? 'is-online' : 'is-warning'}`} />
                    {t('pos.status.workstation', 'Workstation')}: {workstation.deviceKey?.slice(0, 8)}
                    {workstation.isPolling ? ` (${t('pos.status.polling', 'Active')})` : ` (${t('pos.status.stopped', 'Stopped')})`}
                </div>
            )}

            {failedJobs > 0 && (
                <div className="pos-status-bar__item is-error">
                    <span>⚠️</span>
                    {t('pos.status.failedJobs', 'Failed Jobs')}: {failedJobs}
                </div>
            )}

            <div className="pos-status-bar__spacer" />

            <div className="pos-status-bar__item">
                {new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    );
};

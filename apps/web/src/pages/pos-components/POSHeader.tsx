import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, StatusBadge } from '@dms/ui';
import { useAuth } from '../../context/AuthContext';

interface POSHeaderProps {
    session: { id: string } | null;
    sessionStats: {
        totalSales: number;
        totalReturns: number;
        totalDiscounts: number;
        netAmount: number;
        expectedCash?: number;
        cashIn?: number;
        cashOut?: number;
    };
    onLogout: () => void;
    onExit: () => void;
    showExit: boolean;
    onSettings: () => void;
    onCloseSession: () => void;
    formatCurrency: (val: number) => string;
}

export const POSHeader: React.FC<POSHeaderProps> = ({
    session,
    sessionStats,
    onLogout,
    onExit,
    showExit,
    onSettings,
    onCloseSession,
    formatCurrency
}) => {
    const { t } = useTranslation();
    const { user } = useAuth();

    return (
        <div className="pos-header">
            <div className="pos-header__left">
                <div className="pos-header__info">
                    <h1 className="pos-header__title">{t('pos.title')}</h1>
                    <div className="pos-header__meta">
                        <span className="pos-header__user">{user?.username}</span>
                        <span className="pos-header__divider">|</span>
                        <span className="pos-header__branch">{t('common.defaultBranch', 'Main Branch')}</span>
                    </div>
                </div>
                {session && (
                    <StatusBadge variant="success" size="sm" className="pos-header__session-badge">
                        {t('pos.sessionLabel', { id: session.id.slice(0, 8) })}
                    </StatusBadge>
                )}
            </div>

            <div className="pos-stats">
                <div className="pos-stat">
                    <span className="pos-stat__label">{t('pos.totalSales')}:</span>
                    <span className="pos-stat__value">{formatCurrency(sessionStats.totalSales)}</span>
                </div>
                <div className="pos-stat">
                    <span className="pos-stat__label">{t('pos.totalReturns')}:</span>
                    <span className="pos-stat__value text-danger">{formatCurrency(sessionStats.totalReturns)}</span>
                </div>
                <div className="pos-stat">
                    <span className="pos-stat__label">{t('pos.totalCash')}:</span>
                    <span className="pos-stat__value" style={{ color: '#10b981' }}>{formatCurrency(sessionStats.netAmount)}</span>
                </div>
            </div>

            <div className="pos-header__actions">
                {showExit && (
                    <Button variant="ghost" size="sm" onClick={onExit}>
                        {t('pos.exitPos', 'Exit POS')}
                    </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onSettings}>
                    ⚙️ {t('pos.stationSettings', 'Settings')}
                </Button>
                <Button variant="ghost" size="sm" onClick={onLogout}>
                    🚪 {t('nav.topbar.signOut', 'Sign Out')}
                </Button>
                {session && (
                    <Button variant="danger" size="sm" onClick={onCloseSession}>
                        {t('pos.closeSession', 'Close Session')}
                    </Button>
                )}
            </div>
        </div>
    );
};

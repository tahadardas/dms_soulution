import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout, Button, Sidebar, TopBar, useToast } from '@dms/ui';
import { Outlet, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { APP_ROUTES, getBreadcrumbs } from '../routes';
import { BackButton } from './BackButton';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { Breadcrumbs } from './Breadcrumbs';
import Can from './Can';
import { PERMISSIONS } from '../lib/permissions';
import { useTranslation } from 'react-i18next';
import { DEFAULT_CURRENCY, setStoredCurrency } from '../utils/format';
import '../styles/AppShell.css';

export const AppLayout: React.FC = () => {
    const { user, logout, hasPermission, updateUserSettings } = useAuth();
    const api = useApi();
    const location = useLocation();
    const navigate = useNavigate();
    const { goBack } = useBackNavigation();
    const [healthStatus, setHealthStatus] = useState<'ok' | 'down' | 'loading'>('loading');
    const { t, i18n } = useTranslation();
    const toast = useToast();

    useEffect(() => {
        api<{ status: string }>('/health')
            .then(() => setHealthStatus('ok'))
            .catch(() => setHealthStatus('down'));
    }, [api]);

    useEffect(() => {
        api<{ currencyCode?: string }>('/settings/accounting')
            .then((data) => {
                const nextCurrency = data?.currencyCode || DEFAULT_CURRENCY;
                setStoredCurrency(nextCurrency);
            })
            .catch(() => null);
    }, [api]);

    useEffect(() => {
        const handleShortcut = (event: KeyboardEvent) => {
            if (event.altKey && event.key === 'ArrowLeft') {
                event.preventDefault();
                goBack();
            }
        };

        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, [goBack]);

    const breadcrumbs = useMemo(() => getBreadcrumbs(location.pathname), [location.pathname]);

    const navSections = useMemo(() => {
        const navRoutes = APP_ROUTES.filter(route => route.navLabelKey && route.layout !== 'public');
        const items = navRoutes.filter(route => {
            if (!route.permissions || route.permissions.length === 0) return true;
            return route.permissions.some(permission => hasPermission(permission));
        }).map(route => ({
            id: route.id,
            label: route.navLabelKey ? t(route.navLabelKey) : t(route.titleKey),
            href: route.path,
            active: !!matchPath({ path: route.path, end: true }, location.pathname),
            onClick: (event?: React.MouseEvent) => {
                event?.preventDefault();
                navigate(route.path);
            }
        }));

        const sections: Record<string, typeof items> = {};
        items.forEach(item => {
            const route = navRoutes.find(r => r.id === item.id);
            const sectionName = route?.navSectionKey ? t(route.navSectionKey) : t('nav.sections.general');
            if (!sections[sectionName]) sections[sectionName] = [];
            sections[sectionName].push(item);
        });

        return Object.entries(sections).map(([title, sectionItems]) => ({
            title,
            items: sectionItems
        }));
    }, [hasPermission, location.pathname, navigate, t]);

    const changeLanguage = async (lang: 'en' | 'ar') => {
        if (i18n.language === lang) return;
        await i18n.changeLanguage(lang);
        if (user) {
            try {
                await updateUserSettings({ language: lang });
            } catch (err: any) {
                toast.error(err?.message || t('errors.languageSync'));
            }
        }
    };

    return (
        <AdminLayout
            sidebar={(
                <Sidebar
                    header={<div className="app-sidebar__brand">{t('common.appTitle')}</div>}
                    sections={navSections}
                    footer={user ? (
                        <div className="app-sidebar__footer">
                            <div className="app-sidebar__user">
                                <span className="app-sidebar__username">{user.username}</span>
                                <span className="app-sidebar__role">{user.role}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={logout}>
                                {t('nav.topbar.signOut')}
                            </Button>
                        </div>
                    ) : null}
                />
            )}
            topbar={(
                <TopBar
                    logo={<BackButton className="app-topbar__back" />}
                    title={t('common.appTitle')}
                    actions={(
                        <div className="app-topbar__actions">
                            <span className={`app-health app-health--${healthStatus}`}>
                                {healthStatus === 'loading' && t('nav.topbar.apiChecking')}
                                {healthStatus === 'ok' && t('nav.topbar.apiOnline')}
                                {healthStatus === 'down' && t('nav.topbar.apiOffline')}
                            </span>
                            <div className="app-topbar__lang">
                                <Button
                                    variant={i18n.language === 'ar' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => changeLanguage('ar')}
                                >
                                    {t('common.language.ar')}
                                </Button>
                                <Button
                                    variant={i18n.language === 'en' ? 'primary' : 'ghost'}
                                    size="sm"
                                    onClick={() => changeLanguage('en')}
                                >
                                    {t('common.language.en')}
                                </Button>
                            </div>
                            <Can perm={PERMISSIONS.POS_SALE}>
                                <Button variant="primary" size="sm" onClick={() => navigate('/pos')}>
                                    {t('nav.topbar.launchPos')}
                                </Button>
                            </Can>
                            <Button variant="ghost" size="sm" onClick={logout} className="ml-2">
                                🚪 {t('nav.topbar.signOut')}
                            </Button>
                        </div>
                    )}
                >
                    <Breadcrumbs items={breadcrumbs} />
                </TopBar>
            )}
        >
            <div className="app-content">
                <Outlet />
            </div>
        </AdminLayout>
    );
};

export default AppLayout;

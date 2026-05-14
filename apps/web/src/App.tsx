import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { useAuth } from './context/AuthContext';
import { useApi } from './hooks/useApi';
import { setStoredCurrency } from './utils/format';
import { APP_ROUTES, getFallbackPathForRole } from './routes';
import { PermissionCode } from './lib/permissions';
import { LoadingState } from '@dms/ui';

// Essential pages for errors/guards (not lazily loaded to avoid circularity or early failures)
const NoAccessPage = lazy(() => import('./pages/NoAccessPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const DeviceConfigPage = lazy(() => import('./pages/DeviceConfigPage'));

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { user } = useAuth();
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    return children;
};

const RequirePermissions: React.FC<{ permissions?: PermissionCode[]; children: React.ReactElement }> = ({ permissions, children }) => {
    const { hasPermission } = useAuth();
    if (!permissions || permissions.length === 0) return children;
    const allowed = permissions.some(permission => hasPermission(permission));
    if (allowed) return children;
    return <NoAccessPage requiredPermissions={permissions} />;
};

const PublicOnly: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { user } = useAuth();
    if (user) {
        return <Navigate to={getFallbackPathForRole(user.role)} replace />;
    }
    return children;
};

const AppConfigLoader: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { accessToken } = useAuth();
    const api = useApi();

    React.useEffect(() => {
        if (!accessToken) return;
        const loadGlobalSettings = async () => {
            try {
                const settings = await api<any>('/settings');
                if (settings?.accounting?.currencyCode) {
                    setStoredCurrency(settings.accounting.currencyCode);
                }
            } catch (err) {
                // Silent fallback
            }
        };
        loadGlobalSettings();
    }, [accessToken, api]);

    return children;
};

const App = () => {
    const { user } = useAuth();
    const landingPath = user ? getFallbackPathForRole(user.role) : '/login';

    const renderRoute = (route: typeof APP_ROUTES[0]) => {
        const Component = route.component;
        const element = (
            <RequirePermissions permissions={route.permissions}>
                <Component />
            </RequirePermissions>
        );

        if (route.layout === 'public') {
            return (
                <Route
                    key={route.id}
                    path={route.path}
                    element={<PublicOnly>{element}</PublicOnly>}
                />
            );
        }

        return (
            <Route
                key={route.id}
                path={route.path}
                element={<RequireAuth>{element}</RequireAuth>}
            />
        );
    };

    const adminRoutes = APP_ROUTES.filter(r => r.layout === 'admin');
    const posRoutes = APP_ROUTES.filter(r => r.layout === 'pos');
    const publicRoutes = APP_ROUTES.filter(r => r.layout === 'public');

    return (
        <AppConfigLoader>
            <Suspense fallback={<LoadingState fullPage />}>
                <Routes>
                    {/* Device Config is special, no auth required */}
                    <Route path="/device-config" element={<DeviceConfigPage />} />

                    {/* Admin Layout Routes */}
                    <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                        {adminRoutes.map(renderRoute)}
                        <Route path="*" element={<NotFoundPage />} />
                    </Route>

                    {/* POS Routes (usually have their own layout internally or use POSLayout) */}
                    {posRoutes.map(renderRoute)}

                    {/* Public Routes */}
                    {publicRoutes.map(renderRoute)}

                    <Route path="/" element={<Navigate to={landingPath} replace />} />
                </Routes>
            </Suspense>
        </AppConfigLoader>
    );
};

export default App;

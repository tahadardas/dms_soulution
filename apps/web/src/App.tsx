import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import { useAuth } from './context/AuthContext';
import { useApi } from './hooks/useApi';
import { setStoredCurrency } from './utils/format';
import AccountsPage from './pages/AccountsPage';
import DashboardPage from './pages/DashboardPage';
import DeviceConfigPage from './pages/DeviceConfigPage';
import InventoryAdjustPage from './pages/InventoryAdjustPage';
import InventoryMovementsPage from './pages/InventoryMovementsPage';
import InventoryPage from './pages/InventoryPage';
import InventoryTransfersPage from './pages/InventoryTransfersPage';
import JournalDetailPage from './pages/JournalDetailPage';
import JournalNewPage from './pages/JournalNewPage';
import JournalsPage from './pages/JournalsPage';
import LedgerPage from './pages/LedgerPage';
import LoginPage from './pages/LoginPage';
import NoAccessPage from './pages/NoAccessPage';
import NotFoundPage from './pages/NotFoundPage';
import POSPage from './pages/POSPage';
import POSSessionsPage from './pages/POSSessionsPage';
import PrinterJobsPage from './pages/PrinterJobsPage';
import PrinterRoutesPage from './pages/PrinterRoutesPage';
import PrinterTemplatesPage from './pages/PrinterTemplatesPage';
import PrintersPage from './pages/PrintersPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ProductNewPage from './pages/ProductNewPage';
import ProductsPage from './pages/ProductsPage';
import ReportsInventoryPage from './pages/ReportsInventoryPage';
import ReportsMarginsPage from './pages/ReportsMarginsPage';
import ReportsPage from './pages/ReportsPage';
import ReportsSalesPage from './pages/ReportsSalesPage';
import ReportsSessionsZPage from './pages/ReportsSessionsZPage';
import ReportsTrialBalancePage from './pages/ReportsTrialBalancePage';
import SettingsPage from './pages/SettingsPage';
import TrialBalancePage from './pages/TrialBalancePage';
import UserManagementPage from './pages/UserManagementPage';
import BackupManagementPage from './pages/BackupManagementPage';
import PurchaseInvoicesPage from './pages/PurchaseInvoicesPage';
import SuppliersPage from './pages/SuppliersPage';
import SupplierFormPage from './pages/SupplierFormPage';
import SupplierPaymentPage from './pages/SupplierPaymentPage';
import SalesInvoicesPage from './pages/SalesInvoicesPage';
import CustomersPage from './pages/CustomersPage';
import CustomerFormPage from './pages/CustomerFormPage';
import CustomerReceiptPage from './pages/CustomerReceiptPage';
import PurchaseInvoiceFormPage from './pages/PurchaseInvoiceFormPage';
import SalesInvoiceFormPage from './pages/SalesInvoiceFormPage';
import AuditLogsPage from './pages/AuditLogsPage';
import DeliveryCouriersPage from './pages/DeliveryCouriersPage';
import { getFallbackPathForRole, getRouteById } from './routes';
import { PermissionCode } from './lib/permissions';

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
    const withPermissions = (routeId: string, element: React.ReactElement) => (
        <RequirePermissions permissions={getRouteById(routeId)?.permissions}>
            {element}
        </RequirePermissions>
    );

    return (
        <AppConfigLoader>
            <Routes>
                <Route
                path="/login"
                element={
                    <PublicOnly>
                        <LoginPage />
                    </PublicOnly>
                }
            />
            <Route path="/device-config" element={<DeviceConfigPage />} />
            <Route
                element={
                    <RequireAuth>
                        <AppLayout />
                    </RequireAuth>
                }
            >
                <Route path="/dashboard" element={withPermissions('dashboard', <DashboardPage />)} />
                <Route path="/pos/sessions" element={withPermissions('pos-sessions', <POSSessionsPage />)} />
                <Route path="/delivery-couriers" element={withPermissions('delivery-couriers', <DeliveryCouriersPage />)} />
                <Route path="/products" element={withPermissions('products', <ProductsPage />)} />
                <Route path="/products/new" element={withPermissions('products-new', <ProductNewPage />)} />
                <Route path="/products/:id" element={withPermissions('products-detail', <ProductDetailPage />)} />
                <Route path="/inventory" element={withPermissions('inventory', <InventoryPage />)} />
                <Route path="/inventory/movements" element={withPermissions('inventory-movements', <InventoryMovementsPage />)} />
                <Route path="/inventory/adjust" element={withPermissions('inventory-adjust', <InventoryAdjustPage />)} />
                <Route path="/inventory/transfers" element={withPermissions('inventory-transfers', <InventoryTransfersPage />)} />
                <Route path="/purchase-invoices" element={withPermissions('purchase-invoices', <PurchaseInvoicesPage />)} />
                <Route path="/suppliers" element={withPermissions('suppliers', <SuppliersPage />)} />
                <Route path="/suppliers/new" element={withPermissions('suppliers-new', <SupplierFormPage />)} />
                <Route path="/suppliers/payment" element={withPermissions('suppliers-payment', <SupplierPaymentPage />)} />
                <Route path="/suppliers/:id" element={withPermissions('suppliers-detail', <SupplierFormPage />)} />
                <Route path="/purchase-invoices/new" element={withPermissions('purchase-invoices-new', <PurchaseInvoiceFormPage />)} />
                <Route path="/purchase-invoices/:id" element={withPermissions('purchase-invoices-detail', <PurchaseInvoiceFormPage />)} />
                <Route path="/sales-invoices" element={withPermissions('sales-invoices', <SalesInvoicesPage />)} />
                <Route path="/customers" element={withPermissions('customers', <CustomersPage />)} />
                <Route path="/customers/new" element={withPermissions('customers-new', <CustomerFormPage />)} />
                <Route path="/customers/receipt" element={withPermissions('customers-receipt', <CustomerReceiptPage />)} />
                <Route path="/customers/:id" element={withPermissions('customers-detail', <CustomerFormPage />)} />
                <Route path="/sales-invoices/new" element={withPermissions('sales-invoices-new', <SalesInvoiceFormPage />)} />
                <Route path="/sales-invoices/:id" element={withPermissions('sales-invoices-detail', <SalesInvoiceFormPage />)} />
                <Route path="/accounts" element={withPermissions('accounts', <AccountsPage />)} />
                <Route path="/journals" element={withPermissions('journals', <JournalsPage />)} />
                <Route path="/journals/new" element={withPermissions('journals-new', <JournalNewPage />)} />
                <Route path="/journals/:id" element={withPermissions('journals-detail', <JournalDetailPage />)} />
                <Route path="/ledger" element={withPermissions('ledger', <LedgerPage />)} />
                <Route path="/trial-balance" element={withPermissions('trial-balance', <TrialBalancePage />)} />
                <Route path="/reports" element={withPermissions('reports', <ReportsPage />)} />
                <Route path="/reports/sales" element={withPermissions('reports-sales', <ReportsSalesPage />)} />
                <Route path="/reports/sessions-z" element={withPermissions('reports-sessions-z', <ReportsSessionsZPage />)} />
                <Route path="/reports/inventory" element={withPermissions('reports-inventory', <ReportsInventoryPage />)} />
                <Route path="/reports/margins" element={withPermissions('reports-margins', <ReportsMarginsPage />)} />
                <Route path="/reports/trial-balance" element={withPermissions('reports-trial-balance', <ReportsTrialBalancePage />)} />
                <Route path="/printers" element={withPermissions('printers', <PrintersPage />)} />
                <Route path="/printers/routes" element={withPermissions('printers-routes', <PrinterRoutesPage />)} />
                <Route path="/printers/jobs" element={withPermissions('printers-jobs', <PrinterJobsPage />)} />
                <Route path="/printers/templates" element={withPermissions('printers-templates', <PrinterTemplatesPage />)} />
                <Route path="/users" element={withPermissions('users', <UserManagementPage />)} />
                <Route path="/settings/backups" element={withPermissions('backups', <BackupManagementPage />)} />
                <Route path="/settings/audit-logs" element={withPermissions('audit-logs', <AuditLogsPage />)} />
                <Route path="/settings" element={withPermissions('settings', <SettingsPage />)} />
                <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route
                path="/pos"
                element={
                    <RequireAuth>
                        {withPermissions('pos', <POSPage />)}
                    </RequireAuth>
                }
            />
            <Route path="/" element={<Navigate to={landingPath} replace />} />
        </Routes>
        </AppConfigLoader>
    );
};

export default App;

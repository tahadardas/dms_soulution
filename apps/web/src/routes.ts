import { matchPath } from 'react-router-dom';
import { PERMISSIONS, PermissionCode } from './lib/permissions';

export type AppLayoutType = 'admin' | 'pos' | 'public';

export interface AppRouteMeta {
    id: string;
    path: string;
    titleKey: string;
    subtitleKey?: string;
    navLabelKey?: string;
    navSectionKey?: string;
    permissions?: PermissionCode[];
    parentId?: string;
    layout: AppLayoutType;
}

export const APP_ROUTES: AppRouteMeta[] = [
    {
        id: 'dashboard',
        path: '/dashboard',
        titleKey: 'nav.routes.dashboard.title',
        subtitleKey: 'nav.routes.dashboard.subtitle',
        navLabelKey: 'nav.routes.dashboard.navLabel',
        navSectionKey: 'nav.sections.operations',
        permissions: [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'pos',
        path: '/pos',
        titleKey: 'nav.routes.pos.title',
        subtitleKey: 'nav.routes.pos.subtitle',
        navLabelKey: 'nav.routes.pos.navLabel',
        navSectionKey: 'nav.sections.operations',
        permissions: [PERMISSIONS.POS_SALE],
        layout: 'pos'
    },
    {
        id: 'pos-sessions',
        path: '/pos/sessions',
        titleKey: 'nav.routes.posSessions.title',
        subtitleKey: 'nav.routes.posSessions.subtitle',
        navLabelKey: 'nav.routes.posSessions.navLabel',
        navSectionKey: 'nav.sections.operations',
        permissions: [PERMISSIONS.POS_CLOSE_SESSION],
        layout: 'admin'
    },
    {
        id: 'delivery-couriers',
        path: '/delivery-couriers',
        titleKey: 'nav.routes.deliveryCouriers.title',
        subtitleKey: 'nav.routes.deliveryCouriers.subtitle',
        navLabelKey: 'nav.routes.deliveryCouriers.navLabel',
        navSectionKey: 'nav.sections.operations',
        permissions: [PERMISSIONS.DELIVERY_COURIER_VIEW],
        layout: 'admin'
    },
    {
        id: 'products',
        path: '/products',
        titleKey: 'nav.routes.products.title',
        subtitleKey: 'nav.routes.products.subtitle',
        navLabelKey: 'nav.routes.products.navLabel',
        navSectionKey: 'nav.sections.catalog',
        permissions: [PERMISSIONS.PRD_VIEW],
        layout: 'admin'
    },
    {
        id: 'products-new',
        path: '/products/new',
        titleKey: 'nav.routes.productsNew.title',
        subtitleKey: 'nav.routes.productsNew.subtitle',
        parentId: 'products',
        permissions: [PERMISSIONS.PRD_CREATE],
        layout: 'admin'
    },
    {
        id: 'products-detail',
        path: '/products/:id',
        titleKey: 'nav.routes.productsDetail.title',
        subtitleKey: 'nav.routes.productsDetail.subtitle',
        parentId: 'products',
        permissions: [PERMISSIONS.PRD_VIEW],
        layout: 'admin'
    },
    {
        id: 'inventory',
        path: '/inventory',
        titleKey: 'nav.routes.inventory.title',
        subtitleKey: 'nav.routes.inventory.subtitle',
        navLabelKey: 'nav.routes.inventory.navLabel',
        navSectionKey: 'nav.sections.inventory',
        permissions: [PERMISSIONS.INV_VIEW],
        layout: 'admin'
    },
    {
        id: 'inventory-movements',
        path: '/inventory/movements',
        titleKey: 'nav.routes.inventoryMovements.title',
        subtitleKey: 'nav.routes.inventoryMovements.subtitle',
        navLabelKey: 'nav.routes.inventoryMovements.navLabel',
        navSectionKey: 'nav.sections.inventory',
        parentId: 'inventory',
        permissions: [PERMISSIONS.INV_VIEW],
        layout: 'admin'
    },
    {
        id: 'inventory-adjust',
        path: '/inventory/adjust',
        titleKey: 'nav.routes.inventoryAdjust.title',
        subtitleKey: 'nav.routes.inventoryAdjust.subtitle',
        navLabelKey: 'nav.routes.inventoryAdjust.navLabel',
        navSectionKey: 'nav.sections.inventory',
        parentId: 'inventory',
        permissions: [PERMISSIONS.INV_ADJUST],
        layout: 'admin'
    },
    {
        id: 'inventory-transfers',
        path: '/inventory/transfers',
        titleKey: 'nav.routes.inventoryTransfers.title',
        subtitleKey: 'nav.routes.inventoryTransfers.subtitle',
        navLabelKey: 'nav.routes.inventoryTransfers.navLabel',
        navSectionKey: 'nav.sections.inventory',
        parentId: 'inventory',
        permissions: [PERMISSIONS.INV_TRANSFER],
        layout: 'admin'
    },
    {
        id: 'purchase-invoices',
        path: '/purchase-invoices',
        titleKey: 'nav.routes.purchaseInvoices.title',
        subtitleKey: 'nav.routes.purchaseInvoices.subtitle',
        navLabelKey: 'nav.routes.purchaseInvoices.navLabel',
        navSectionKey: 'nav.sections.inventory',
        permissions: [PERMISSIONS.INV_PURCHASE],
        layout: 'admin'
    },
    {
        id: 'suppliers',
        path: '/suppliers',
        titleKey: 'nav.routes.suppliers.title',
        subtitleKey: 'nav.routes.suppliers.subtitle',
        navLabelKey: 'nav.routes.suppliers.navLabel',
        navSectionKey: 'nav.sections.inventory',
        permissions: [PERMISSIONS.INV_PURCHASE],
        layout: 'admin'
    },
    {
        id: 'suppliers-new',
        path: '/suppliers/new',
        titleKey: 'suppliers.actions.newSupplier',
        parentId: 'suppliers',
        permissions: [PERMISSIONS.INV_PURCHASE],
        layout: 'admin'
    },
    {
        id: 'suppliers-detail',
        path: '/suppliers/:id',
        titleKey: 'suppliers.actions.editSupplier',
        parentId: 'suppliers',
        permissions: [PERMISSIONS.INV_PURCHASE],
        layout: 'admin'
    },
    {
        id: 'suppliers-payment',
        path: '/suppliers/payment',
        titleKey: 'suppliers.actions.recordPayment',
        parentId: 'suppliers',
        permissions: [PERMISSIONS.INV_PURCHASE],
        layout: 'admin'
    },
    {
        id: 'purchase-invoices-new',
        path: '/purchase-invoices/new',
        titleKey: 'nav.routes.purchaseInvoicesNew.title',
        subtitleKey: 'nav.routes.purchaseInvoicesNew.subtitle',
        parentId: 'purchase-invoices',
        permissions: [PERMISSIONS.INV_PURCHASE],
        layout: 'admin'
    },
    {
        id: 'purchase-invoices-detail',
        path: '/purchase-invoices/:id',
        titleKey: 'nav.routes.purchaseInvoicesDetail.title',
        subtitleKey: 'nav.routes.purchaseInvoicesDetail.subtitle',
        parentId: 'purchase-invoices',
        permissions: [PERMISSIONS.INV_PURCHASE],
        layout: 'admin'
    },
    {
        id: 'customers',
        path: '/customers',
        titleKey: 'nav.routes.customers.title',
        subtitleKey: 'nav.routes.customers.subtitle',
        navLabelKey: 'nav.routes.customers.navLabel',
        navSectionKey: 'nav.sections.inventory',
        permissions: [PERMISSIONS.INV_SALES_INV],
        layout: 'admin'
    },
    {
        id: 'customers-new',
        path: '/customers/new',
        titleKey: 'customers.actions.newCustomer',
        parentId: 'customers',
        permissions: [PERMISSIONS.INV_SALES_INV],
        layout: 'admin'
    },
    {
        id: 'customers-detail',
        path: '/customers/:id',
        titleKey: 'customers.actions.editCustomer',
        parentId: 'customers',
        permissions: [PERMISSIONS.INV_SALES_INV],
        layout: 'admin'
    },
    {
        id: 'customers-receipt',
        path: '/customers/receipt',
        titleKey: 'customers.actions.recordReceipt',
        parentId: 'customers',
        permissions: [PERMISSIONS.INV_SALES_INV],
        layout: 'admin'
    },
    {
        id: 'sales-invoices',
        path: '/sales-invoices',
        titleKey: 'nav.routes.salesInvoices.title',
        subtitleKey: 'nav.routes.salesInvoices.subtitle',
        navLabelKey: 'nav.routes.salesInvoices.navLabel',
        navSectionKey: 'nav.sections.inventory',
        permissions: [PERMISSIONS.INV_SALES_INV],
        layout: 'admin'
    },
    {
        id: 'sales-invoices-new',
        path: '/sales-invoices/new',
        titleKey: 'nav.routes.salesInvoicesNew.title',
        subtitleKey: 'nav.routes.salesInvoicesNew.subtitle',
        parentId: 'sales-invoices',
        permissions: [PERMISSIONS.INV_SALES_INV],
        layout: 'admin'
    },
    {
        id: 'sales-invoices-detail',
        path: '/sales-invoices/:id',
        titleKey: 'nav.routes.salesInvoicesDetail.title',
        subtitleKey: 'nav.routes.salesInvoicesDetail.subtitle',
        parentId: 'sales-invoices',
        permissions: [PERMISSIONS.INV_SALES_INV],
        layout: 'admin'
    },
    {
        id: 'accounts',
        path: '/accounts',
        titleKey: 'nav.routes.accounts.title',
        subtitleKey: 'nav.routes.accounts.subtitle',
        navLabelKey: 'nav.routes.accounts.navLabel',
        navSectionKey: 'nav.sections.accounting',
        permissions: [PERMISSIONS.ACC_VIEW_COA],
        layout: 'admin'
    },
    {
        id: 'journals',
        path: '/journals',
        titleKey: 'nav.routes.journals.title',
        subtitleKey: 'nav.routes.journals.subtitle',
        navLabelKey: 'nav.routes.journals.navLabel',
        navSectionKey: 'nav.sections.accounting',
        permissions: [PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'journals-new',
        path: '/journals/new',
        titleKey: 'nav.routes.journalsNew.title',
        subtitleKey: 'nav.routes.journalsNew.subtitle',
        parentId: 'journals',
        permissions: [PERMISSIONS.ACC_CREATE_JOURNAL],
        layout: 'admin'
    },
    {
        id: 'journals-detail',
        path: '/journals/:id',
        titleKey: 'nav.routes.journalsDetail.title',
        subtitleKey: 'nav.routes.journalsDetail.subtitle',
        parentId: 'journals',
        permissions: [PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'ledger',
        path: '/ledger',
        titleKey: 'nav.routes.ledger.title',
        subtitleKey: 'nav.routes.ledger.subtitle',
        navLabelKey: 'nav.routes.ledger.navLabel',
        navSectionKey: 'nav.sections.accounting',
        permissions: [PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'trial-balance',
        path: '/trial-balance',
        titleKey: 'nav.routes.trialBalance.title',
        subtitleKey: 'nav.routes.trialBalance.subtitle',
        navLabelKey: 'nav.routes.trialBalance.navLabel',
        navSectionKey: 'nav.sections.accounting',
        permissions: [PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'reports',
        path: '/reports',
        titleKey: 'nav.routes.reports.title',
        subtitleKey: 'nav.routes.reports.subtitle',
        navLabelKey: 'nav.routes.reports.navLabel',
        navSectionKey: 'nav.sections.reports',
        permissions: [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'reports-sales',
        path: '/reports/sales',
        titleKey: 'nav.routes.reportsSales.title',
        subtitleKey: 'nav.routes.reportsSales.subtitle',
        navLabelKey: 'nav.routes.reportsSales.navLabel',
        navSectionKey: 'nav.sections.reports',
        parentId: 'reports',
        permissions: [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'reports-sessions-z',
        path: '/reports/sessions-z',
        titleKey: 'nav.routes.reportsSessionsZ.title',
        subtitleKey: 'nav.routes.reportsSessionsZ.subtitle',
        navLabelKey: 'nav.routes.reportsSessionsZ.navLabel',
        navSectionKey: 'nav.sections.reports',
        parentId: 'reports',
        permissions: [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'reports-inventory',
        path: '/reports/inventory',
        titleKey: 'nav.routes.reportsInventory.title',
        subtitleKey: 'nav.routes.reportsInventory.subtitle',
        navLabelKey: 'nav.routes.reportsInventory.navLabel',
        navSectionKey: 'nav.sections.reports',
        parentId: 'reports',
        permissions: [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'reports-margins',
        path: '/reports/margins',
        titleKey: 'nav.routes.reportsMargins.title',
        subtitleKey: 'nav.routes.reportsMargins.subtitle',
        navLabelKey: 'nav.routes.reportsMargins.navLabel',
        navSectionKey: 'nav.sections.reports',
        parentId: 'reports',
        permissions: [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'reports-trial-balance',
        path: '/reports/trial-balance',
        titleKey: 'nav.routes.reportsTrialBalance.title',
        subtitleKey: 'nav.routes.reportsTrialBalance.subtitle',
        navLabelKey: 'nav.routes.reportsTrialBalance.navLabel',
        navSectionKey: 'nav.sections.reports',
        parentId: 'reports',
        permissions: [PERMISSIONS.RPT_VIEW, PERMISSIONS.ACC_VIEW_REPORTS],
        layout: 'admin'
    },
    {
        id: 'printers',
        path: '/printers',
        titleKey: 'nav.routes.printers.title',
        subtitleKey: 'nav.routes.printers.subtitle',
        navLabelKey: 'nav.routes.printers.navLabel',
        navSectionKey: 'nav.sections.printing',
        permissions: [PERMISSIONS.SET_MANAGE_PRINTERS],
        layout: 'admin'
    },
    {
        id: 'printers-routes',
        path: '/printers/routes',
        titleKey: 'nav.routes.printersRoutes.title',
        subtitleKey: 'nav.routes.printersRoutes.subtitle',
        navLabelKey: 'nav.routes.printersRoutes.navLabel',
        navSectionKey: 'nav.sections.printing',
        parentId: 'printers',
        permissions: [PERMISSIONS.SET_MANAGE_PRINTERS],
        layout: 'admin'
    },
    {
        id: 'printers-jobs',
        path: '/printers/jobs',
        titleKey: 'nav.routes.printersJobs.title',
        subtitleKey: 'nav.routes.printersJobs.subtitle',
        navLabelKey: 'nav.routes.printersJobs.navLabel',
        navSectionKey: 'nav.sections.printing',
        parentId: 'printers',
        permissions: [PERMISSIONS.SET_MANAGE_PRINTERS],
        layout: 'admin'
    },
    {
        id: 'printers-templates',
        path: '/printers/templates',
        titleKey: 'nav.routes.printersTemplates.title',
        subtitleKey: 'nav.routes.printersTemplates.subtitle',
        navLabelKey: 'nav.routes.printersTemplates.navLabel',
        navSectionKey: 'nav.sections.printing',
        parentId: 'printers',
        permissions: [PERMISSIONS.SET_MANAGE_PRINTERS],
        layout: 'admin'
    },
    {
        id: 'users',
        path: '/users',
        titleKey: 'nav.routes.users.title',
        subtitleKey: 'nav.routes.users.subtitle',
        navLabelKey: 'nav.routes.users.navLabel',
        navSectionKey: 'nav.sections.administration',
        permissions: [PERMISSIONS.SET_MANAGE_USERS],
        layout: 'admin'
    },
    {
        id: 'settings',
        path: '/settings',
        titleKey: 'nav.routes.settings.title',
        subtitleKey: 'nav.routes.settings.subtitle',
        navLabelKey: 'nav.routes.settings.navLabel',
        navSectionKey: 'nav.sections.administration',
        permissions: [PERMISSIONS.SET_MANAGE_SETTINGS],
        parentId: 'dashboard',
        layout: 'admin'
    },
    {
        id: 'backups',
        path: '/settings/backups',
        titleKey: 'nav.routes.backups.title',
        subtitleKey: 'nav.routes.backups.subtitle',
        navLabelKey: 'nav.routes.backups.navLabel',
        navSectionKey: 'nav.sections.administration',
        permissions: [PERMISSIONS.SET_MANAGE_SETTINGS],
        parentId: 'settings',
        layout: 'admin'
    },
    {
        id: 'audit-logs',
        path: '/settings/audit-logs',
        titleKey: 'nav.routes.auditLogs.title',
        subtitleKey: 'nav.routes.auditLogs.subtitle',
        navLabelKey: 'nav.routes.auditLogs.navLabel',
        navSectionKey: 'nav.sections.administration',
        permissions: [PERMISSIONS.SET_VIEW_AUDIT],
        parentId: 'settings',
        layout: 'admin'
    },
    {
        id: 'login',
        path: '/login',
        titleKey: 'nav.routes.login.title',
        layout: 'public'
    }
];

const routeMap = new Map(APP_ROUTES.map(route => [route.id, route]));

export const getRouteByPath = (pathname: string) => {
    return APP_ROUTES.find(route => matchPath({ path: route.path, end: true }, pathname));
};

export const getBreadcrumbs = (pathname: string) => {
    const current = getRouteByPath(pathname);
    if (!current || current.layout === 'public') return [];

    const breadcrumbs: { labelKey: string; path: string }[] = [];
    let node: AppRouteMeta | undefined = current;

    while (node) {
        breadcrumbs.unshift({ labelKey: node.titleKey, path: node.path });
        node = node.parentId ? routeMap.get(node.parentId) : undefined;
    }

    return breadcrumbs;
};

export const getFallbackPathForRole = (role?: string | null) => {
    if (role && role.toLowerCase() === 'cashier') {
        return '/pos';
    }
    return '/dashboard';
};

export const getRouteById = (id: string) => routeMap.get(id);

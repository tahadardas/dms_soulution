export const PERMISSIONS = {
    // POS
    POS_SALE: 'POS.Sale',
    POS_VOID: 'POS.Void',
    POS_DISCOUNT: 'POS.Discount',
    POS_CLOSE_SESSION: 'POS.CloseSession',
    POS_RETURNS: 'POS.Returns',
    POS_ORDER_VOID: 'POS.OrderVoid',
    POS_RETURN_CREATE: 'POS.ReturnCreate',
    POS_DELIVERY_COLLECT: 'POS.DeliveryCollect',
    POS_CASH_IN: 'POS.CashIn',
    POS_CASH_OUT: 'POS.CashOut',
    // Printing permissions
    POS_ORDER_PRINT: 'POS.OrderPrint',
    POS_ORDER_REPRINT: 'POS.OrderReprint',

    // Inventory
    INV_ADJUST: 'INV.Adjust',
    INV_VIEW: 'INV.View',
    INV_TRANSFER: 'INV.Transfer',
    INV_PURCHASE: 'INV.Purchase',
    INV_SALES_INV: 'INV.SalesInvoice',

    // Products
    PRD_VIEW: 'PRD.View',
    PRD_CREATE: 'PRD.Create',
    PRD_EDIT: 'PRD.Edit',

    // Accounting
    ACC_VIEW_COA: 'ACC.ViewCOA',
    ACC_EDIT_COA: 'ACC.EditCOA',
    ACC_CREATE_JOURNAL: 'ACC.CreateJournal',
    ACC_POST_JOURNAL: 'ACC.PostJournal',
    ACC_REVERSE_JOURNAL: 'ACC.ReverseJournal',
    ACC_VIEW_REPORTS: 'ACC.ViewReports',
    RPT_VIEW: 'RPT.View',

    // Settings / Admin
    SET_MANAGE_PRINTERS: 'SET.ManagePrinters',
    SET_MANAGE_SETTINGS: 'SET.ManageSettings',
    SET_MANAGE_USERS: 'SET.ManageUsers',
    SET_MANAGE_ROLES: 'SET.ManageRoles',
    SET_VIEW_AUDIT: 'SET.ViewAudit',
    // Printing management
    PRINTING_MANAGE: 'PRINTING.Manage',
    PRINTER_TEST: 'PRINTER.Test',
    // Manager Approval permissions
    MANAGER_APPROVAL: 'MANAGER.Approval',
    POS_SESSION_CLOSE_APPROVE: 'POS.SessionCloseApprove',
    POS_RETURN_APPROVE: 'POS.ReturnApprove',
    POS_ORDER_VOID_APPROVE: 'POS.OrderVoidApprove',
    POS_REPRINT_APPROVE: 'POS.ReprintApprove',
    POS_DISCOUNT_APPROVE: 'POS.DiscountApprove',
    POS_CASH_OUT_APPROVE: 'POS.CashOutApprove',

    // Delivery Couriers
    DELIVERY_COURIER_VIEW: 'DELIVERY_COURIER_VIEW',
    DELIVERY_COURIER_CREATE: 'DELIVERY_COURIER_CREATE',
    DELIVERY_COURIER_UPDATE: 'DELIVERY_COURIER_UPDATE',
    DELIVERY_COURIER_REPORT: 'DELIVERY_COURIER_REPORT',
    DELIVERY_COURIER_COMMISSION_PAY: 'DELIVERY_COURIER_COMMISSION_PAY'
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PRESETS = {
    ADMIN: {
        name: 'Admin',
        description: 'Full system access',
        permissions: Object.values(PERMISSIONS)
    },
    CASHIER: {
        name: 'Cashier',
        description: 'Standard POS operations',
        permissions: [
            PERMISSIONS.POS_SALE,
            PERMISSIONS.POS_CLOSE_SESSION,
            PERMISSIONS.POS_DELIVERY_COLLECT,
            PERMISSIONS.POS_ORDER_PRINT,
            PERMISSIONS.DELIVERY_COURIER_VIEW,
            PERMISSIONS.DELIVERY_COURIER_CREATE
        ]
    },
    SUPERVISOR: {
        name: 'Supervisor',
        description: 'POS management and overrides',
        permissions: [
            PERMISSIONS.POS_SALE,
            PERMISSIONS.POS_VOID,
            PERMISSIONS.POS_DISCOUNT,
            PERMISSIONS.POS_CLOSE_SESSION,
            PERMISSIONS.POS_RETURNS,
            PERMISSIONS.POS_ORDER_VOID,
            PERMISSIONS.POS_RETURN_CREATE,
            PERMISSIONS.POS_DELIVERY_COLLECT,
            PERMISSIONS.POS_CASH_IN,
            PERMISSIONS.POS_CASH_OUT,
            PERMISSIONS.INV_VIEW,
            PERMISSIONS.PRD_VIEW,
            PERMISSIONS.MANAGER_APPROVAL,
            PERMISSIONS.POS_SESSION_CLOSE_APPROVE,
            PERMISSIONS.POS_RETURN_APPROVE,
            PERMISSIONS.POS_ORDER_VOID_APPROVE,
            PERMISSIONS.POS_REPRINT_APPROVE,
            PERMISSIONS.POS_DISCOUNT_APPROVE,
            PERMISSIONS.POS_CASH_OUT_APPROVE,
            PERMISSIONS.POS_ORDER_PRINT,
            PERMISSIONS.POS_ORDER_REPRINT,
            PERMISSIONS.DELIVERY_COURIER_VIEW,
            PERMISSIONS.DELIVERY_COURIER_CREATE,
            PERMISSIONS.DELIVERY_COURIER_UPDATE,
            PERMISSIONS.DELIVERY_COURIER_REPORT
        ]
    },
    ACCOUNTANT: {
        name: 'Accountant',
        description: 'Financial reporting and posting',
        permissions: [
            PERMISSIONS.ACC_VIEW_COA,
            PERMISSIONS.ACC_CREATE_JOURNAL,
            PERMISSIONS.ACC_POST_JOURNAL,
            PERMISSIONS.ACC_REVERSE_JOURNAL,
            PERMISSIONS.ACC_VIEW_REPORTS,
            PERMISSIONS.RPT_VIEW,
            PERMISSIONS.INV_VIEW,
            PERMISSIONS.INV_PURCHASE,
            PERMISSIONS.INV_SALES_INV,
            PERMISSIONS.DELIVERY_COURIER_REPORT
        ]
    }
};

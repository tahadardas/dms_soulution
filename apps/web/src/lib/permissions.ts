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
    POS_ORDER_PRINT: 'POS.OrderPrint',
    POS_ORDER_REPRINT: 'POS.OrderReprint',

    // Inventory
    INV_VIEW: 'INV.View',
    INV_ADJUST: 'INV.Adjust',
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

    // Reporting
    RPT_VIEW: 'RPT.View',

    // Settings
    SET_MANAGE_PRINTERS: 'SET.ManagePrinters',
    SET_MANAGE_SETTINGS: 'SET.ManageSettings',
    SET_MANAGE_USERS: 'SET.ManageUsers',
    SET_VIEW_AUDIT: 'SET.ViewAudit',

    // Delivery Couriers
    DELIVERY_COURIER_VIEW: 'DLV.CourierView',
    DELIVERY_COURIER_CREATE: 'DLV.CourierCreate',
    DELIVERY_COURIER_UPDATE: 'DLV.CourierUpdate',
    DELIVERY_COURIER_REPORT: 'DLV.CourierReport',
    DELIVERY_COURIER_COMMISSION_PAY: 'DLV.CourierCommissionPay'
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

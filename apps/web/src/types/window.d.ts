export interface ElectronPrinter {
    name: string;
    displayName: string;
    description: string;
    status: number;
    isDefault: boolean;
    options: any;
}

export interface PrinterConfig {
    receiptPrinter: string | null;
    kitchenPrinter: string | null;
}

export interface DeviceInfo {
    deviceKey: string;
    name: string;
    apiUrl: string;
    platform: string;
    hostname: string;
}

export interface PrintJobPollingOptions {
    apiUrl?: string;
    accessToken?: string;
    intervalMs?: number;
    deviceName?: string;
    branchId?: number | null;
}

export interface ElectronAPI {
    getConfig: () => Promise<{ apiUrl: string; kioskMode: boolean; language: string; deviceKey?: string }>;
    saveConfig: (config: { apiUrl: string; kioskMode: boolean; language?: string }) => Promise<{ success: boolean }>;
    toggleKiosk: () => void;
    onConfigUpdated: (callback: (config: any) => void) => () => void;
    getLanguage: () => Promise<string>;
    saveLanguage: (language: string) => Promise<{ success: boolean }>;
    getDeviceInfo: () => Promise<DeviceInfo>;
    setDeviceKey: (deviceKey: string) => Promise<{ deviceKey: string }>;
    getPrinters: () => Promise<ElectronPrinter[]>;
    printHtml: (printerName: string, html: string) => Promise<{ success: boolean; error?: string }>;
    printText: (printerName: string, text: string, paperWidth?: number) => Promise<{ success: boolean; error?: string }>;
    printData: (printerName: string, data: string, type?: 'html' | 'raw') => Promise<{ success: boolean; error?: string }>;
    getPrinterConfig: () => Promise<PrinterConfig>;
    savePrinterConfig: (config: Partial<PrinterConfig>) => Promise<{ success: boolean }>;
    startPrintJobPolling: (options: PrintJobPollingOptions) => Promise<{ success: boolean; deviceKey?: string; intervalMs?: number; error?: string }>;
    stopPrintJobPolling: () => Promise<{ success: boolean }>;
    getPollingStatus: () => Promise<{ isPolling: boolean; isBusy: boolean; deviceKey: string }>;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

import { Order } from '../types/orders'; // Assuming this is correct or I will find out
import { ElectronPrinter, PrinterConfig } from '../types/window';

const isElectron = () => !!window.electronAPI;

export const PrinterService = {
    isAvailable: isElectron,

    getPrinters: async (): Promise<ElectronPrinter[]> => {
        if (!isElectron()) return [];
        try {
            return await window.electronAPI!.getPrinters();
        } catch (error) {
            console.error('Failed to get printers:', error);
            return [];
        }
    },

    getConfig: async (): Promise<PrinterConfig> => {
        if (!isElectron()) return { receiptPrinter: null, kitchenPrinter: null };
        try {
            return await window.electronAPI!.getPrinterConfig();
        } catch (error) {
            console.error('Failed to get printer config:', error);
            return { receiptPrinter: null, kitchenPrinter: null };
        }
    },

    saveConfig: async (config: Partial<PrinterConfig>): Promise<boolean> => {
        if (!isElectron()) return false;
        try {
            const result = await window.electronAPI!.savePrinterConfig(config);
            return result.success;
        } catch (error) {
            console.error('Failed to save printer config:', error);
            return false;
        }
    },

    printTest: async (printerName: string) => {
        if (!isElectron()) return;
        const content = [
            'اختبار طباعة',
            'DMS SOULUTION',
            `الطابعة: ${printerName}`,
            `الوقت: ${new Date().toLocaleString()}`
        ].join('\n');
        await window.electronAPI!.printText(printerName, content, 80);
    },

    getDeviceInfo: async () => {
        if (!isElectron()) return null;
        return window.electronAPI!.getDeviceInfo();
    },

    startJobPolling: async (options: { apiUrl?: string; accessToken: string; intervalMs?: number; deviceName?: string; branchId?: number | null }) => {
        if (!isElectron()) return { success: false, error: 'Desktop app is required' };
        return window.electronAPI!.startPrintJobPolling(options);
    },

    stopJobPolling: async () => {
        if (!isElectron()) return { success: true };
        return window.electronAPI!.stopPrintJobPolling();
    },

    printReceipt: async (order: Order) => {
        if (!isElectron()) return;
        const config = await PrinterService.getConfig();
        if (!config.receiptPrinter) {
            console.warn('No receipt printer configured');
            return;
        }

        const content = `
      <div style="font-family: monospace; width: 300px; font-size: 12px;">
        <h2 style="text-align: center;">Receipt</h2>
        <p style="text-align: center;">Order #${order.order_number}</p>
        <p style="text-align: center;">${new Date().toLocaleString()}</p>
        <hr/>
        ${order.lines.map(line => `
          <div style="display: flex; justify-content: space-between;">
            <span>${line.quantity}x ${line.product_name}</span>
            <span>${line.total.toFixed(2)}</span>
          </div>
        `).join('')}
        <hr/>
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>Total</span>
          <span>${order.total_amount.toFixed(2)}</span>
        </div>
      </div>
    `;

        await window.electronAPI!.printData(config.receiptPrinter, content);
    },

    printKOT: async (order: Order) => {
        if (!isElectron()) return;
        const config = await PrinterService.getConfig();
        if (!config.kitchenPrinter) {
            console.warn('No kitchen printer configured');
            return;
        }

        const content = `
      <div style="font-family: monospace; width: 300px; font-size: 14px;">
        <h2 style="text-align: center;">KITCHEN ORDER</h2>
        <p style="text-align: center;">Order #${order.order_number}</p>
        <p style="text-align: center;">${new Date().toLocaleTimeString()}</p>
        <hr/>
        ${order.lines.map(line => `
          <div style="margin-bottom: 5px;">
            <div style="font-weight: bold;">${line.quantity}x ${line.product_name}</div>
            ${line.notes ? `<div style="font-size: 12px; font-style: italic;">Note: ${line.notes}</div>` : ''}
          </div>
        `).join('')}
        <hr/>
      </div>
    `;

        await window.electronAPI!.printData(config.kitchenPrinter, content);
    }
};

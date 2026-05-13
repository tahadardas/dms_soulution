import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
    toggleKiosk: () => ipcRenderer.send('toggle-kiosk'),
    onConfigUpdated: (callback: any) => {
        const listener = (_event: any, value: any) => callback(value);
        ipcRenderer.on('config-updated', listener);
        return () => ipcRenderer.removeListener('config-updated', listener);
    },
    getLanguage: () => ipcRenderer.invoke('get-language'),
    saveLanguage: (language: string) => ipcRenderer.invoke('save-language', language),
    getDeviceInfo: () => ipcRenderer.invoke('device:getInfo'),
    setDeviceKey: (deviceKey: string) => ipcRenderer.invoke('device:setKey', deviceKey),
    // Printer APIs
    getPrinters: () => ipcRenderer.invoke('printers:list'),
    printHtml: (printerName: string, html: string) =>
        ipcRenderer.invoke('printers:printHtml', { printerName, html }),
    printText: (printerName: string, text: string, paperWidth?: number) =>
        ipcRenderer.invoke('printers:printText', { printerName, text, paperWidth }),
    printData: (printerName: string, data: string, type: 'html' | 'raw' = 'html') =>
        ipcRenderer.invoke('printers:print', { printerName, data, type }),
    getPrinterConfig: () => ipcRenderer.invoke('get-printer-config'),
    savePrinterConfig: (config: any) => ipcRenderer.invoke('save-printer-config', config),
    startPrintJobPolling: (options: any) => ipcRenderer.invoke('printJobs:startPolling', options),
    stopPrintJobPolling: () => ipcRenderer.invoke('printJobs:stopPolling'),
    getPollingStatus: () => ipcRenderer.invoke('printJobs:getStatus'),
});

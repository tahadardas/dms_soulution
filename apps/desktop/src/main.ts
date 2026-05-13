import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import Store from 'electron-store';
import crypto from 'crypto';
import os from 'os';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';

const store = new Store();
let printPollingTimer: NodeJS.Timeout | null = null;
let printPollingBusy = false;
let apiProcess: ChildProcess | null = null;

type PrintPollingOptions = {
    apiUrl?: string;
    accessToken?: string;
    intervalMs?: number;
    deviceName?: string;
    branchId?: number | null;
};

type PendingPrintJob = {
    id: string;
    content?: string | null;
    printer_name?: string | null;
    windows_printer_name?: string | null;
    paper_width?: number | null;
};

const resolveRendererPath = () => {
    const isDev = !app.isPackaged;
    if (isDev) {
        return { type: 'url', target: 'http://localhost:5173' } as const;
    }
    const indexPath = path.join(process.resourcesPath, 'web-dist', 'index.html');
    return { type: 'file', target: indexPath } as const;
};

const getApiUrl = () => {
    // In production, we MUST use the local production port (127.0.0.1:4780)
    const defaultProdUrl = `http://127.0.0.1:${apiPort}`;
    
    if (app.isPackaged) {
        // Force the correct URL in production to avoid issues with stale settings in Electron Store
        return defaultProdUrl;
    }
    
    // In development, allow overriding via env or store, but default to 3000
    const devUrl = (process.env.DMS_API_URL || store.get('apiUrl', 'http://localhost:3000')) as string;
    return devUrl;
};

const isDev = !app.isPackaged;
const apiPort = 4780;

const getProductionPaths = () => {
    const baseDir = 'C:\\DMS';
    return {
        data: path.join(baseDir, 'data'),
        backups: path.join(baseDir, 'backups'),
        logs: path.join(baseDir, 'logs'),
        config: path.join(baseDir, 'config'),
        db: path.join(baseDir, 'data', 'dms.db')
    };
};

const ensureDirectoryStructure = () => {
    if (isDev) return;
    const paths = getProductionPaths();
    Object.values(paths).forEach(p => {
        const dir = path.extname(p) ? path.dirname(p) : p;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
};

const startApiProcess = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (isDev) {
            resolve();
            return;
        }

        ensureDirectoryStructure();
        const paths = getProductionPaths();
        
        // In production, the API dist should be in resources/api
        const apiPath = path.join(process.resourcesPath, 'api', 'dist', 'index.js');
        const logFile = path.join(paths.logs, 'api.log');
        const logStream = fs.createWriteStream(logFile, { flags: 'a' });

        console.log(`Starting API from: ${apiPath}`);
        
        apiProcess = spawn(process.execPath, [apiPath], {
            env: {
                ...process.env,
                DMS_PORT: String(apiPort),
                DMS_DB_PATH: paths.db,
                NODE_ENV: 'production',
                NODE_PATH: [
                    path.join(process.resourcesPath, 'app.asar', 'node_modules'),
                    path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
                ].join(path.delimiter),
                ELECTRON_RUN_AS_NODE: '1',
                JWT_SECRET: 'dms_soulution_pos_production_secret_2026_safe',
                REFRESH_SECRET: 'dms_soulution_pos_production_refresh_secret_2026_safe',
                DMS_CORS_ORIGINS: 'http://127.0.0.1:4780',
                DMS_DESKTOP: 'true'
            },
            stdio: ['ignore', 'pipe', 'pipe']
        });

        apiProcess.stdout?.pipe(logStream);
        apiProcess.stderr?.pipe(logStream);

        apiProcess.stdout?.on('data', (data) => {
            console.log(`API STDOUT: ${data}`);
        });
        apiProcess.stderr?.on('data', (data) => {
            console.error(`API STDERR: ${data}`);
        });

        let resolved = false;
        const checkHealth = async () => {
            if (resolved) return;
            try {
                const res = await fetch(`http://127.0.0.1:${apiPort}/health`);
                if (res.ok) {
                    resolved = true;
                    console.log('API Health Check: Success');
                    resolve();
                } else {
                    console.log(`API Health Check: Status ${res.status}, retrying...`);
                    setTimeout(checkHealth, 1000);
                }
            } catch (err: any) {
                console.log(`API Health Check: Failed (${err.message}), retrying...`);
                setTimeout(checkHealth, 1000);
            }
        };

        // Reduce retries to 20 seconds for faster feedback during debug
        const timeoutId = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.error('API Health Check: Timed out after 20 seconds');
                reject(new Error('API Startup Timeout'));
            }
        }, 20000);

        const originalResolve = resolve;
        resolve = ((value?: void | PromiseLike<void>) => {
            clearTimeout(timeoutId);
            return originalResolve(value);
        }) as any;

        checkHealth();

        apiProcess.on('error', (err) => {
            console.error('Failed to start API process:', err);
            if (!resolved) {
                resolved = true;
                reject(err);
            }
        });

        apiProcess.on('exit', (code) => {
            console.log(`API process exited with code ${code}`);
            if (!resolved) {
                resolved = true;
                reject(new Error(`API process exited with code ${code}`));
            }
        });
    });
};

const getDeviceKey = () => {
    const existing = store.get('deviceKey') as string | undefined;
    if (existing) return existing;
    const normalizedHost = os.hostname().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
    const generated = `${normalizedHost}-${crypto.randomUUID().slice(0, 8)}`;
    store.set('deviceKey', generated);
    return generated;
};

const setDeviceKey = (deviceKey: string) => {
    const normalized = String(deviceKey || '').trim();
    if (!normalized) {
        throw new Error('deviceKey is required');
    }
    store.set('deviceKey', normalized);
    return normalized;
};

const getDeviceInfo = () => ({
    deviceKey: getDeviceKey(),
    name: (store.get('deviceName', os.hostname()) as string) || os.hostname(),
    apiUrl: getApiUrl(),
    platform: process.platform,
    hostname: os.hostname()
});

const buildHeaders = (accessToken?: string): Record<string, string> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
};

const apiFetch = async <T>(
    apiUrl: string,
    pathName: string,
    options: { method?: string; accessToken?: string; body?: unknown } = {}
): Promise<T> => {
    const response = await fetch(`${apiUrl.replace(/\/$/, '')}${pathName}`, {
        method: options.method || 'GET',
        headers: buildHeaders(options.accessToken),
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : {};
    if (!response.ok) {
        throw new Error(data?.error || data?.message || `Request failed: ${response.status}`);
    }
    return data as T;
};

const loadPrintHtml = async (html: string, deviceName: string) => {
    const printWindow = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    try {
        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        await new Promise<void>((resolve, reject) => {
            printWindow.webContents.print({
                silent: true,
                deviceName,
                printBackground: true
            }, (success, failureReason) => {
                if (success) {
                    resolve();
                    return;
                }
                reject(new Error(failureReason || 'Windows print failed'));
            });
        });
    } finally {
        if (!printWindow.isDestroyed()) {
            printWindow.close();
        }
    }
};

const escapeHtml = (value: string) => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const printText = async (text: string, deviceName: string, paperWidth = 80) => {
    const widthMm = paperWidth || 80;
    const html = `
        <!doctype html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="utf-8" />
            <style>
                @page { size: ${widthMm}mm auto; margin: 0; }
                body { margin: 0; padding: 8px; font-family: "Courier New", monospace; font-size: 12px; }
                pre { margin: 0; white-space: pre-wrap; direction: rtl; text-align: right; }
            </style>
        </head>
        <body><pre>${escapeHtml(text)}</pre></body>
        </html>
    `;
    await loadPrintHtml(html, deviceName);
};

const printJobOnWindowsPrinter = async (job: PendingPrintJob) => {
    const printerName = job.windows_printer_name || job.printer_name;
    if (!printerName) {
        throw new Error('Windows printer name is missing');
    }

    const content = job.content || '';
    const looksLikeHtml = /<\/?[a-z][\s\S]*>/i.test(content);
    if (looksLikeHtml) {
        await loadPrintHtml(content, printerName);
        return;
    }
    await printText(content, printerName, job.paper_width || 80);
};

const registerAndHeartbeat = async (options: Required<Pick<PrintPollingOptions, 'apiUrl'>> & PrintPollingOptions) => {
    const device = getDeviceInfo();
    const deviceName = options.deviceName || device.name;
    store.set('deviceName', deviceName);
    await apiFetch(options.apiUrl, '/printing/workstations/register', {
        method: 'POST',
        accessToken: options.accessToken,
        body: {
            deviceKey: device.deviceKey,
            name: deviceName,
            branchId: options.branchId ?? null
        }
    });
    await apiFetch(options.apiUrl, `/printing/workstations/${encodeURIComponent(device.deviceKey)}/heartbeat`, {
        method: 'POST',
        accessToken: options.accessToken
    });
};

const pollPrintJobs = async (options: Required<Pick<PrintPollingOptions, 'apiUrl'>> & PrintPollingOptions) => {
    if (printPollingBusy) return;
    printPollingBusy = true;
    const deviceKey = getDeviceKey();

    try {
        await apiFetch(options.apiUrl, `/printing/workstations/${encodeURIComponent(deviceKey)}/heartbeat`, {
            method: 'POST',
            accessToken: options.accessToken
        });
        const response = await apiFetch<{ items: PendingPrintJob[] }>(
            options.apiUrl,
            `/printing/jobs/pending-local?deviceKey=${encodeURIComponent(deviceKey)}`,
            { accessToken: options.accessToken }
        );

        for (const job of response.items || []) {
            try {
                const lockedJob = await apiFetch<PendingPrintJob>(options.apiUrl, `/printing/jobs/${job.id}/lock`, {
                    method: 'POST',
                    accessToken: options.accessToken,
                    body: { deviceKey }
                });
                await printJobOnWindowsPrinter({ ...job, ...lockedJob });
                await apiFetch(options.apiUrl, `/printing/jobs/${job.id}/complete`, {
                    method: 'POST',
                    accessToken: options.accessToken,
                    body: { deviceKey }
                });
            } catch (error: any) {
                await apiFetch(options.apiUrl, `/printing/jobs/${job.id}/fail`, {
                    method: 'POST',
                    accessToken: options.accessToken,
                    body: {
                        deviceKey,
                        errorMessage: String(error?.message || error)
                    }
                }).catch(() => undefined);
            }
        }
    } finally {
        printPollingBusy = false;
    }
};

const applyKioskMode = (win: BrowserWindow, enabled: boolean) => {
    win.setKiosk(enabled);
    win.setFullScreen(enabled);
    win.setAutoHideMenuBar(enabled);
};

function createWindow() {
    const apiUrl = getApiUrl();
    const isKiosk = store.get('kioskMode', false) as boolean;

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        fullscreen: isKiosk,
        kiosk: isKiosk,
        autoHideMenuBar: isKiosk,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false, // Disable sandbox for debugging
            webSecurity: false, // Relax security for file:// protocol debugging
            nodeIntegrationInSubFrames: false,
            webviewTag: false,
            devTools: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        icon: path.join(__dirname, '..', 'build', 'icon.png'),
    });

    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    const renderer = resolveRendererPath();
    if (renderer.type === 'url') {
        win.loadURL(renderer.target);
        win.webContents.openDevTools();
    } else {
        win.loadFile(renderer.target).catch(err => {
            console.error('Failed to load index.html:', err);
        });
    }

    // Add load failure logging
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error(`Failed to load URL: ${validatedURL}, Error: ${errorDescription} (${errorCode})`);
    });

    // Allow opening DevTools in production for debugging via Ctrl+Shift+I
    win.webContents.on('before-input-event', (event, input) => {
        if (input.control && input.shift && input.key.toLowerCase() === 'i') {
            win.webContents.openDevTools();
        }
    });

    // Handle Kiosk toggle
    ipcMain.on('toggle-kiosk', () => {
        const current = win.isKiosk();
        applyKioskMode(win, !current);
        store.set('kioskMode', !current);
        win.webContents.send('config-updated', {
            apiUrl: store.get('apiUrl', apiUrl),
            kioskMode: !current
        });
    });
}

// IPC Handlers for Config
ipcMain.handle('get-config', () => {
    return {
        apiUrl: getApiUrl(),
        kioskMode: store.get('kioskMode', false),
        language: store.get('language', 'en'),
        deviceKey: getDeviceKey(),
    };
});

ipcMain.handle('save-config', (event, config) => {
    store.set('apiUrl', config.apiUrl);
    store.set('kioskMode', config.kioskMode);
    if (config.language) {
        store.set('language', config.language);
    }
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
        applyKioskMode(win, Boolean(config.kioskMode));
    }
    event.sender.send('config-updated', {
        apiUrl: config.apiUrl,
        kioskMode: config.kioskMode,
        language: store.get('language', 'en')
    });
    return { success: true };
});

ipcMain.handle('device:getInfo', () => getDeviceInfo());

ipcMain.handle('device:setKey', (_event, deviceKey: string) => {
    return { deviceKey: setDeviceKey(deviceKey) };
});

ipcMain.handle('get-language', () => {
    return store.get('language', 'en') as string;
});

ipcMain.handle('save-language', (_event, language: string) => {
    store.set('language', language);
    return { success: true };
});



// Printer IPC Handlers
ipcMain.handle('printers:list', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return [];
    // Use getPrintersAsync if available (newer Electron versions), otherwise getPrinters
    // @ts-ignore - types might not be fully up to date for all electron versions in this workspace
    if (win.webContents.getPrintersAsync) {
        // @ts-ignore
        return await win.webContents.getPrintersAsync();
    }
    // @ts-ignore
    return win.webContents.getPrinters();
});

ipcMain.handle('printers:printHtml', async (_event, { printerName, html }) => {
    try {
        await loadPrintHtml(String(html || ''), String(printerName || ''));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('printers:printText', async (_event, { printerName, text, paperWidth }) => {
    try {
        await printText(String(text || ''), String(printerName || ''), Number(paperWidth || 80));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('printers:print', async (_event, { printerName, data, type }) => {
    try {
        if (type === 'raw' || type === 'text') {
            await printText(String(data || ''), String(printerName || ''), 80);
        } else {
            await loadPrintHtml(String(data || ''), String(printerName || ''));
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('printJobs:startPolling', async (_event, options: PrintPollingOptions = {}) => {
    const apiUrl = options.apiUrl || getApiUrl();
    const intervalMs = Math.max(Number(options.intervalMs || 3000), 1000);

    if (!options.accessToken) {
        return { success: false, error: 'Access token is required to poll print jobs' };
    }

    if (printPollingTimer) {
        clearInterval(printPollingTimer);
        printPollingTimer = null;
    }

    try {
        await registerAndHeartbeat({ ...options, apiUrl });
        await pollPrintJobs({ ...options, apiUrl });
        printPollingTimer = setInterval(() => {
            pollPrintJobs({ ...options, apiUrl }).catch((error) => {
                console.error('Print job polling failed:', error);
            });
        }, intervalMs);
        return { success: true, deviceKey: getDeviceKey(), intervalMs };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('printJobs:stopPolling', () => {
    if (printPollingTimer) {
        clearInterval(printPollingTimer);
        printPollingTimer = null;
    }
    printPollingBusy = false;
    return { success: true };
});

ipcMain.handle('printJobs:getStatus', () => {
    return {
        isPolling: !!printPollingTimer,
        isBusy: printPollingBusy,
        deviceKey: getDeviceKey()
    };
});

ipcMain.handle('get-printer-config', () => {
    return {
        receiptPrinter: store.get('receiptPrinter', null),
        kitchenPrinter: store.get('kitchenPrinter', null),
    };
});


ipcMain.handle('save-printer-config', (_event, config) => {
    if (config.receiptPrinter !== undefined) store.set('receiptPrinter', config.receiptPrinter);
    if (config.kitchenPrinter !== undefined) store.set('kitchenPrinter', config.kitchenPrinter);
    return { success: true };
});

app.whenReady().then(async () => {
    try {
        await startApiProcess();
        createWindow();
    } catch (err) {
        console.error('Startup failed:', err);
        // show error dialog or specialized window
        createWindow(); // still create window but it might show connection error
    }

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    if (printPollingTimer) {
        clearInterval(printPollingTimer);
        printPollingTimer = null;
    }
    if (apiProcess) {
        apiProcess.kill();
        apiProcess = null;
    }
});

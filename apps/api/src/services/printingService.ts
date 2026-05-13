import Database, { Database as DatabaseType } from 'better-sqlite3';
import net from 'net';
import crypto from 'crypto';
import { PrintJob, Printer, PrinterRoute, PrintTemplate } from '@dms/shared/src/schemas/printing';

type JobType = 'RECEIPT' | 'KOT' | 'REPORT' | 'TEST';
type PrintJobStatus = 'PENDING' | 'LOCKED' | 'PRINTING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

interface EnqueueInput {
    type: JobType;
    payload: Record<string, any>;
    templateId?: number;
    branchId?: number | null;
    station?: string;
    categoryIds?: number[];
    reportName?: string;
}

interface WorkstationInput {
    deviceKey: string;
    name: string;
    branchId?: number | null;
}

interface LocalJobActionInput {
    jobId: string;
    deviceKey: string;
}

export class PrintingService {
    private db: DatabaseType;
    private maxRetries = 3;

    constructor(db: DatabaseType) {
        this.db = db;
    }

    // --- Printers ---

    listPrinters() {
        return this.db.prepare(`
            SELECT p.*, b.name as branch_name
            FROM printers p
            LEFT JOIN branches b ON b.id = p.branch_id
            ORDER BY p.name
        `).all();
    }

    createPrinter(printer: Omit<Printer, 'id'> & { branch_id?: number | null; display_name?: string; windows_printer_name?: string; device_id?: string; paper_width?: number }) {
        const stmt = this.db.prepare(
            'INSERT INTO printers (name, branch_id, type, target, ip_address, port, is_active, display_name, windows_printer_name, device_id, paper_width) VALUES (@name, @branch_id, @type, @target, @ip_address, @port, @is_active, @display_name, @windows_printer_name, @device_id, @paper_width)'
        );
        const info = stmt.run({
            ...printer,
            branch_id: printer.branch_id ?? null,
            is_active: printer.is_active ?? 1,
            display_name: printer.display_name ?? null,
            windows_printer_name: printer.windows_printer_name ?? null,
            device_id: printer.device_id ?? null,
            paper_width: printer.paper_width ?? 80
        });
        return { ...printer, id: info.lastInsertRowid };
    }

    updatePrinter(id: number, updates: Partial<Printer & { branch_id?: number | null; display_name?: string; windows_printer_name?: string; device_id?: string; paper_width?: number }>) {
        const current = this.db.prepare('SELECT * FROM printers WHERE id = ?').get(id) as any;
        if (!current) throw new Error('Printer not found');
        const next = { ...current, ...updates };
        this.db.prepare(`
            UPDATE printers
            SET name = @name,
                branch_id = @branch_id,
                type = @type,
                target = @target,
                ip_address = @ip_address,
                port = @port,
                is_active = @is_active,
                display_name = @display_name,
                windows_printer_name = @windows_printer_name,
                device_id = @device_id,
                paper_width = @paper_width
            WHERE id = @id
        `).run({
            id,
            name: next.name,
            branch_id: next.branch_id ?? null,
            type: next.type,
            target: next.target,
            ip_address: next.ip_address ?? null,
            port: next.port ?? 9100,
            is_active: typeof next.is_active === 'boolean' ? (next.is_active ? 1 : 0) : (next.is_active ?? 1),
            display_name: next.display_name ?? null,
            windows_printer_name: next.windows_printer_name ?? null,
            device_id: next.device_id ?? null,
            paper_width: next.paper_width ?? 80
        });
        return this.db.prepare('SELECT * FROM printers WHERE id = ?').get(id);
    }

    deletePrinter(id: number) {
        this.db.prepare('UPDATE printers SET is_active = 0 WHERE id = ?').run(id);
        return { success: true };
    }

    // --- Routes ---

    listRoutes() {
        return this.db.prepare(`
            SELECT pr.*, p.name as printer_name, t.name as template_name
            FROM printer_routes pr
            LEFT JOIN printers p ON p.id = pr.printer_id
            LEFT JOIN print_templates t ON t.id = pr.template_id
            ORDER BY pr.job_type, pr.scope_type
        `).all();
    }

    createRoute(route: Omit<PrinterRoute, 'id'> & {
        scope_type: string;
        scope_value?: string | null;
        job_type: JobType;
        branch_id?: number | null;
        template_id?: number | null;
        is_active?: number | boolean;
    }) {
        const info = this.db.prepare(`
            INSERT INTO printer_routes (scope_type, scope_value, job_type, branch_id, printer_id, template_id, is_active)
            VALUES (@scope_type, @scope_value, @job_type, @branch_id, @printer_id, @template_id, @is_active)
        `).run({
            scope_type: route.scope_type,
            scope_value: route.scope_value ?? null,
            job_type: route.job_type,
            branch_id: route.branch_id ?? null,
            printer_id: route.printer_id,
            template_id: route.template_id ?? null,
            is_active: typeof route.is_active === 'boolean' ? (route.is_active ? 1 : 0) : (route.is_active ?? 1)
        });
        return { ...route, id: info.lastInsertRowid };
    }

    updateRoute(id: number, updates: any) {
        const current = this.db.prepare('SELECT * FROM printer_routes WHERE id = ?').get(id) as any;
        if (!current) throw new Error('Route not found');
        const next = { ...current, ...updates };
        this.db.prepare(`
            UPDATE printer_routes
            SET scope_type = @scope_type,
                scope_value = @scope_value,
                job_type = @job_type,
                branch_id = @branch_id,
                printer_id = @printer_id,
                template_id = @template_id,
                is_active = @is_active
            WHERE id = @id
        `).run({
            id,
            scope_type: next.scope_type,
            scope_value: next.scope_value ?? null,
            job_type: next.job_type,
            branch_id: next.branch_id ?? null,
            printer_id: next.printer_id,
            template_id: next.template_id ?? null,
            is_active: typeof next.is_active === 'boolean' ? (next.is_active ? 1 : 0) : (next.is_active ?? 1)
        });
        return this.db.prepare('SELECT * FROM printer_routes WHERE id = ?').get(id);
    }

    deleteRoute(id: number) {
        this.db.prepare('DELETE FROM printer_routes WHERE id = ?').run(id);
        return { success: true };
    }

    // --- Templates ---

    listTemplates() {
        return this.db.prepare('SELECT * FROM print_templates WHERE is_active = 1 ORDER BY type, name').all();
    }

    createTemplate(template: Omit<PrintTemplate, 'id'>) {
        const info = this.db.prepare(`
            INSERT INTO print_templates (name, type, content, is_default, is_active, updated_at)
            VALUES (@name, @type, @content, @is_default, @is_active, datetime('now'))
        `).run({
            name: template.name,
            type: template.type,
            content: template.content,
            is_default: template.is_default ? 1 : 0,
            is_active: template.is_active === false ? 0 : 1
        });
        if (template.is_default) {
            this.clearDefaultTemplates(template.type, info.lastInsertRowid as number);
        }
        return { ...template, id: info.lastInsertRowid };
    }

    updateTemplate(id: number, updates: Partial<PrintTemplate>) {
        const current = this.db.prepare('SELECT * FROM print_templates WHERE id = ?').get(id) as any;
        if (!current) throw new Error('Template not found');
        const next = { ...current, ...updates };
        this.db.prepare(`
            UPDATE print_templates
            SET name = @name,
                type = @type,
                content = @content,
                is_default = @is_default,
                is_active = @is_active,
                updated_at = datetime('now')
            WHERE id = @id
        `).run({
            id,
            name: next.name,
            type: next.type,
            content: next.content,
            is_default: typeof next.is_default === 'boolean' ? (next.is_default ? 1 : 0) : (next.is_default ?? 0),
            is_active: typeof next.is_active === 'boolean' ? (next.is_active ? 1 : 0) : (next.is_active ?? 1)
        });
        if (next.is_default) {
            this.clearDefaultTemplates(next.type, id);
        }
        return this.db.prepare('SELECT * FROM print_templates WHERE id = ?').get(id);
    }

    deleteTemplate(id: number) {
        this.db.prepare('UPDATE print_templates SET is_active = 0 WHERE id = ?').run(id);
        return { success: true };
    }

    private clearDefaultTemplates(type: string, keepId: number) {
        this.db.prepare('UPDATE print_templates SET is_default = 0 WHERE type = ? AND id != ?').run(type, keepId);
    }

    // --- Jobs ---

    listJobs(filters: { status?: string; type?: string; limit?: number } = {}) {
        const clauses: string[] = [];
        const params: any[] = [];
        if (filters.status) {
            clauses.push('j.status = ?');
            params.push(filters.status);
        }
        if (filters.type) {
            clauses.push('j.type = ?');
            params.push(filters.type);
        }
        const whereClause = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const limit = filters.limit ?? 200;
        return this.db.prepare(`
            SELECT j.*, p.name as printer_name
            FROM print_jobs j
            LEFT JOIN printers p ON p.id = j.printer_id
            ${whereClause}
            ORDER BY j.created_at DESC
            LIMIT ?
        `).all(...params, limit);
    }

    getJobStatus(id: string) {
        return this.db.prepare('SELECT * FROM print_jobs WHERE id = ?').get(id);
    }

    retryJob(id: string) {
        this.db.prepare(`
            UPDATE print_jobs
            SET status = 'PENDING',
                error_message = NULL,
                last_error = NULL,
                locked_by = NULL,
                locked_at = NULL,
                processed_at = NULL,
                updated_at = datetime('now')
            WHERE id = ?
        `).run(id);
        return { success: true };
    }

    enqueueJob(input: EnqueueInput) {
        const route = this.resolveRoute(input);
        if (!route?.printer_id) {
            throw new Error('No printer route found');
        }

        const templateId = input.templateId ?? route.template_id ?? this.getDefaultTemplateId(this.mapTemplateType(input.type));
        const template = templateId ? this.db.prepare('SELECT * FROM print_templates WHERE id = ?').get(templateId) as any : null;
        const content = template ? this.renderTemplate(template.content, input.payload) : this.renderTemplate('{{payload}}', { payload: JSON.stringify(input.payload, null, 2) });
        const id = crypto.randomUUID();
        const payload = JSON.stringify(input.payload || {});

        this.db.prepare(`
            INSERT INTO print_jobs (
                id, printer_id, status, type, content, payload, template_id,
                attempts, retries, retry_count, created_at, updated_at
            )
            VALUES (?, ?, 'PENDING', ?, ?, ?, ?, 0, 0, 0, datetime('now'), datetime('now'))
        `).run(id, route.printer_id, input.type, content, payload, templateId ?? null);

        return { id };
    }

    enqueueDirectJob(input: { printerId: number; type: JobType; payload: Record<string, any>; content?: string; templateId?: number | null }) {
        const printer = this.db.prepare('SELECT id FROM printers WHERE id = ? AND is_active = 1').get(input.printerId);
        if (!printer) {
            throw new Error('Printer not available');
        }

        const templateId = input.templateId ?? this.getDefaultTemplateId(this.mapTemplateType(input.type));
        const template = templateId ? this.db.prepare('SELECT * FROM print_templates WHERE id = ?').get(templateId) as any : null;
        const content = input.content ?? (template
            ? this.renderTemplate(template.content, input.payload)
            : this.renderTemplate('{{payload}}', { payload: JSON.stringify(input.payload, null, 2) }));
        const id = crypto.randomUUID();

        this.db.prepare(`
            INSERT INTO print_jobs (
                id, printer_id, status, type, content, payload, template_id,
                attempts, retries, retry_count, created_at, updated_at
            )
            VALUES (?, ?, 'PENDING', ?, ?, ?, ?, 0, 0, 0, datetime('now'), datetime('now'))
        `).run(id, input.printerId, input.type, content, JSON.stringify(input.payload || {}), templateId ?? null);

        return { id };
    }

    async processQueue(limit = 20) {
        const pendingJobs = this.db.prepare(`
            SELECT j.*
            FROM print_jobs j
            JOIN printers p ON p.id = j.printer_id
            WHERE j.status = 'PENDING'
              AND p.type = 'NETWORK'
              AND COALESCE(j.attempts, j.retries, j.retry_count, 0) < ?
            ORDER BY j.created_at ASC
            LIMIT ?
        `).all(this.maxRetries, limit) as any[];

        for (const job of pendingJobs) {
            const nextAttempts = (job.attempts ?? job.retries ?? job.retry_count ?? 0) + 1;
            try {
                const lockInfo = this.db.prepare(`
                    UPDATE print_jobs
                    SET status = 'PRINTING',
                        attempts = ?,
                        retries = ?,
                        retry_count = ?,
                        last_attempt_at = datetime('now'),
                        updated_at = datetime('now')
                    WHERE id = ? AND status = 'PENDING'
                `).run(nextAttempts, nextAttempts, nextAttempts, job.id);
                if (lockInfo.changes === 0) {
                    continue;
                }

                const printer = this.db.prepare('SELECT * FROM printers WHERE id = ? AND is_active = 1').get(job.printer_id) as any;
                if (!printer) throw new Error('Printer not available');

                const content = job.content || '';
                await this.sendToNetworkPrinter(printer, content);

                this.updateJobStatus(job.id, 'SUCCESS', {
                    processedAt: true,
                    clearError: true
                });
            } catch (error: any) {
                const finalStatus: PrintJobStatus = nextAttempts >= this.maxRetries ? 'FAILED' : 'PENDING';
                this.db.prepare(`
                    UPDATE print_jobs
                    SET status = ?,
                        attempts = ?,
                        retries = ?,
                        retry_count = ?,
                        error_message = ?,
                        last_error = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `).run(finalStatus, nextAttempts, nextAttempts, nextAttempts, String(error?.message || error), String(error?.message || error), job.id);
            }
        }

        return { processed: pendingJobs.length };
    }

    registerWorkstation(input: WorkstationInput) {
        const deviceKey = String(input.deviceKey || '').trim();
        const name = String(input.name || '').trim();
        if (!deviceKey) throw new Error('deviceKey is required');
        if (!name) throw new Error('name is required');

        const existing = this.db.prepare('SELECT * FROM workstations WHERE device_key = ?').get(deviceKey) as any;
        const id = existing?.id || crypto.randomUUID();
        this.db.prepare(`
            INSERT INTO workstations (id, name, device_key, branch_id, is_active, last_seen_at, created_at)
            VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            ON CONFLICT(device_key) DO UPDATE SET
                name = excluded.name,
                branch_id = excluded.branch_id,
                is_active = 1,
                last_seen_at = excluded.last_seen_at
        `).run(id, name, deviceKey, input.branchId ?? null);

        return this.db.prepare('SELECT * FROM workstations WHERE device_key = ?').get(deviceKey);
    }

    heartbeatWorkstation(deviceKey: string) {
        const info = this.db.prepare(`
            UPDATE workstations
            SET last_seen_at = datetime('now')
            WHERE device_key = ? AND is_active = 1
        `).run(deviceKey);
        if (info.changes === 0) {
            throw new Error('Workstation not registered');
        }
        return { success: true };
    }

    listPendingLocalJobs(deviceKey: string, limit = 20) {
        if (!deviceKey) throw new Error('deviceKey is required');
        return this.db.prepare(`
            SELECT j.*, p.name as printer_name, p.windows_printer_name, p.paper_width, p.type as printer_type
            FROM print_jobs j
            JOIN printers p ON p.id = j.printer_id
            WHERE j.status = 'PENDING'
              AND p.is_active = 1
              AND p.type IN ('USB', 'WINDOWS')
              AND p.device_id = ?
            ORDER BY j.created_at ASC
            LIMIT ?
        `).all(deviceKey, limit);
    }

    lockLocalJob(input: LocalJobActionInput) {
        const info = this.db.prepare(`
            UPDATE print_jobs
            SET status = 'LOCKED',
                locked_by = ?,
                locked_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ?
              AND status = 'PENDING'
              AND EXISTS (
                  SELECT 1
                  FROM printers p
                  WHERE p.id = print_jobs.printer_id
                    AND p.type IN ('USB', 'WINDOWS')
                    AND p.device_id = ?
                    AND p.is_active = 1
              )
        `).run(input.deviceKey, input.jobId, input.deviceKey);

        if (info.changes === 0) {
            throw new Error('Print job is not available for this workstation');
        }

        return this.getJobStatus(input.jobId);
    }

    completeLocalJob(input: LocalJobActionInput) {
        const info = this.db.prepare(`
            UPDATE print_jobs
            SET status = 'SUCCESS',
                processed_at = datetime('now'),
                error_message = NULL,
                last_error = NULL,
                updated_at = datetime('now')
            WHERE id = ?
              AND status IN ('LOCKED', 'PRINTING')
              AND locked_by = ?
        `).run(input.jobId, input.deviceKey);

        if (info.changes === 0) {
            throw new Error('Print job is not locked by this workstation');
        }

        return { success: true };
    }

    failLocalJob(input: LocalJobActionInput & { errorMessage: string }) {
        const errorMessage = String(input.errorMessage || 'Local printer failed');
        const info = this.db.prepare(`
            UPDATE print_jobs
            SET status = 'FAILED',
                error_message = ?,
                last_error = ?,
                attempts = COALESCE(attempts, 0) + 1,
                retries = COALESCE(retries, 0) + 1,
                retry_count = COALESCE(retry_count, 0) + 1,
                processed_at = datetime('now'),
                updated_at = datetime('now')
            WHERE id = ?
              AND status IN ('LOCKED', 'PRINTING')
              AND locked_by = ?
        `).run(errorMessage, errorMessage, input.jobId, input.deviceKey);

        if (info.changes === 0) {
            throw new Error('Print job is not locked by this workstation');
        }

        return { success: true };
    }

    async testPrinter(printerId: number, processNow = true) {
        const printer = this.db.prepare('SELECT * FROM printers WHERE id = ? AND is_active = 1').get(printerId) as any;
        if (!printer) throw new Error('Printer not found');

        const content = [
            'اختبار طباعة',
            'DMS SOULUTION',
            `الطابعة: ${printer.name}`,
            `الوقت: ${new Date().toLocaleString('ar-SY')}`
        ].join('\n');

        const job = this.enqueueDirectJob({
            printerId,
            type: 'TEST',
            payload: {
                printer_name: printer.name,
                time: new Date().toISOString()
            },
            content
        });

        const processResult = printer.type === 'NETWORK' && processNow
            ? await this.processQueue(10)
            : undefined;

        return { success: true, job, processResult };
    }

    private updateJobStatus(id: string, status: PrintJobStatus, options: { processedAt?: boolean; clearError?: boolean } = {}) {
        this.db.prepare(`
            UPDATE print_jobs
            SET status = ?,
                processed_at = CASE WHEN ? THEN datetime('now') ELSE processed_at END,
                error_message = CASE WHEN ? THEN NULL ELSE error_message END,
                last_error = CASE WHEN ? THEN NULL ELSE last_error END,
                updated_at = datetime('now')
            WHERE id = ?
        `).run(status, options.processedAt ? 1 : 0, options.clearError ? 1 : 0, options.clearError ? 1 : 0, id);
    }

    private resolveRoute(input: EnqueueInput) {
        const routes = this.db.prepare(`
            SELECT *
            FROM printer_routes
            WHERE is_active = 1
              AND job_type = ?
              AND (branch_id IS NULL OR branch_id = ?)
            ORDER BY CASE WHEN branch_id IS NULL THEN 2 ELSE 1 END,
            CASE scope_type
                WHEN 'CATEGORY' THEN 1
                WHEN 'STATION' THEN 2
                WHEN 'REPORT' THEN 3
                WHEN 'DEFAULT' THEN 4
                ELSE 5
            END
        `).all(input.type, input.branchId ?? null) as any[];

        if (input.categoryIds && input.categoryIds.length > 0) {
            const match = routes.find(route => route.scope_type === 'CATEGORY' && input.categoryIds!.includes(Number(route.scope_value)));
            if (match) return match;
        }
        if (input.station) {
            const match = routes.find(route => route.scope_type === 'STATION' && String(route.scope_value).toUpperCase() === input.station!.toUpperCase());
            if (match) return match;
        }
        if (input.reportName) {
            const match = routes.find(route => route.scope_type === 'REPORT' && String(route.scope_value) === input.reportName);
            if (match) return match;
        }
        const defaultRoute = routes.find(route => route.scope_type === 'DEFAULT');
        if (defaultRoute) return defaultRoute;

        return this.resolveFallbackPrinter(input.type, input.branchId ?? null);
    }

    private resolveFallbackPrinter(type: JobType, branchId: number | null) {
        const targetMap: Record<JobType, string> = {
            KOT: 'KITCHEN',
            RECEIPT: 'CASHIER',
            REPORT: 'CASHIER',
            TEST: 'CASHIER'
        };
        const target = targetMap[type];
        const printer = this.db.prepare(`
            SELECT *
            FROM printers
            WHERE is_active = 1
              AND target = ?
              AND (branch_id IS NULL OR branch_id = ?)
            ORDER BY id ASC
            LIMIT 1
        `).get(target, branchId ?? null) as any;
        return printer ? { printer_id: printer.id } : null;
    }

    private getDefaultTemplateId(type: string) {
        const row = this.db.prepare('SELECT id FROM print_templates WHERE type = ? AND is_default = 1 AND is_active = 1 LIMIT 1').get(type) as { id: number } | undefined;
        return row?.id ?? null;
    }

    private mapTemplateType(type: JobType) {
        if (type === 'REPORT') return 'Z_REPORT';
        return type;
    }

    private renderTemplate(template: string, payload: Record<string, any>) {
        return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
            const value = key.split('.').reduce((acc: any, part: string) => acc?.[part], payload);
            if (value === undefined || value === null) return '';
            return String(value);
        });
    }

    private sendToNetworkPrinter(printer: any, content: string) {
        if (!printer.ip_address) {
            throw new Error('Printer IP address is missing');
        }
        const port = printer.port || 9100;
        const socket = new net.Socket();
        const payload = Buffer.from(content, 'utf8');
        const init = Buffer.from([0x1b, 0x40]);
        const cut = Buffer.from([0x1d, 0x56, 0x41, 0x00]);
        const output = Buffer.concat([init, payload, Buffer.from('\n\n'), cut]);

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.destroy();
                reject(new Error('Print timeout'));
            }, 5000);

            socket.once('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            socket.connect(port, printer.ip_address, () => {
                socket.write(output, () => {
                    socket.end();
                });
            });
            socket.on('close', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
}

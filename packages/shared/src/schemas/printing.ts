import { z } from 'zod';

export const PrinterTypeEnum = z.enum(['NETWORK', 'USB', 'WINDOWS', 'PDF']);
export const PrinterTargetEnum = z.enum(['CASHIER', 'KITCHEN', 'BAR', 'LABEL']);

export const PrinterSchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    type: PrinterTypeEnum,
    target: PrinterTargetEnum,
    ip_address: z.string().optional(),
    port: z.number().default(9100),
    is_active: z.boolean().default(true),
});

export type Printer = z.infer<typeof PrinterSchema>;

export const PrintJobStatusEnum = z.enum(['PENDING', 'LOCKED', 'PRINTING', 'SUCCESS', 'FAILED', 'CANCELLED']);
export const PrintJobTypeEnum = z.enum(['RECEIPT', 'KOT', 'REPORT', 'TEST']);

export const PrinterRouteSchema = z.object({
    id: z.number().optional(),
    scope_type: z.enum(['CATEGORY', 'STATION', 'REPORT', 'DEFAULT']),
    scope_value: z.string().optional(),
    job_type: PrintJobTypeEnum,
    branch_id: z.number().optional(),
    printer_id: z.number(),
    template_id: z.number().optional(),
    is_active: z.boolean().default(true),
});

export type PrinterRoute = z.infer<typeof PrinterRouteSchema>;

export const PrintJobSchema = z.object({
    id: z.string().optional(), // UUID
    printer_id: z.number(),
    status: PrintJobStatusEnum.default('PENDING'),
    type: PrintJobTypeEnum,
    content: z.string().optional(), // Rendered ESC/POS/text payload
    payload: z.string().optional(), // JSON string payload for template rendering
    template_id: z.number().optional(),
    attempts: z.number().default(0),
    error_message: z.string().optional(),
    device_id: z.string().optional(),
    locked_by: z.string().optional(),
    locked_at: z.string().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    processed_at: z.string().optional(),
});

export type PrintJob = z.infer<typeof PrintJobSchema>;

export const PrintTemplateTypeEnum = z.enum(['RECEIPT', 'KOT', 'Z_REPORT']);

export const PrintTemplateSchema = z.object({
    id: z.number().optional(),
    name: z.string(),
    type: PrintTemplateTypeEnum,
    content: z.string(),
    is_default: z.boolean().default(false),
    is_active: z.boolean().default(true),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
});

export type PrintTemplate = z.infer<typeof PrintTemplateSchema>;

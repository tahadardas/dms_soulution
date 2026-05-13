import { z } from 'zod';
export declare const PrinterTypeEnum: z.ZodEnum<["NETWORK", "USB", "BLUETOOTH"]>;
export declare const PrinterTargetEnum: z.ZodEnum<["CASHIER", "KITCHEN", "BAR", "LABEL"]>;
export declare const PrinterSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    name: z.ZodString;
    type: z.ZodEnum<["NETWORK", "USB", "BLUETOOTH"]>;
    target: z.ZodEnum<["CASHIER", "KITCHEN", "BAR", "LABEL"]>;
    ip_address: z.ZodOptional<z.ZodString>;
    port: z.ZodDefault<z.ZodNumber>;
    is_active: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "NETWORK" | "USB" | "BLUETOOTH";
    name: string;
    target: "CASHIER" | "KITCHEN" | "BAR" | "LABEL";
    port: number;
    is_active: boolean;
    id?: number | undefined;
    ip_address?: string | undefined;
}, {
    type: "NETWORK" | "USB" | "BLUETOOTH";
    name: string;
    target: "CASHIER" | "KITCHEN" | "BAR" | "LABEL";
    id?: number | undefined;
    ip_address?: string | undefined;
    port?: number | undefined;
    is_active?: boolean | undefined;
}>;
export type Printer = z.infer<typeof PrinterSchema>;
export declare const PrinterRouteSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    category_id: z.ZodOptional<z.ZodNumber>;
    printer_id: z.ZodNumber;
    is_default: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    printer_id: number;
    is_default: boolean;
    id?: number | undefined;
    category_id?: number | undefined;
}, {
    printer_id: number;
    id?: number | undefined;
    category_id?: number | undefined;
    is_default?: boolean | undefined;
}>;
export type PrinterRoute = z.infer<typeof PrinterRouteSchema>;
export declare const PrintJobStatusEnum: z.ZodEnum<["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>;
export declare const PrintJobTypeEnum: z.ZodEnum<["RECEIPT", "KOT", "REPORT", "TEST"]>;
export declare const PrintJobSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    printer_id: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<["PENDING", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]>>;
    type: z.ZodEnum<["RECEIPT", "KOT", "REPORT", "TEST"]>;
    content: z.ZodString;
    retry_count: z.ZodDefault<z.ZodNumber>;
    error_message: z.ZodOptional<z.ZodString>;
    created_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "RECEIPT" | "KOT" | "REPORT" | "TEST";
    status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
    printer_id: number;
    content: string;
    retry_count: number;
    id?: string | undefined;
    error_message?: string | undefined;
    created_at?: string | undefined;
}, {
    type: "RECEIPT" | "KOT" | "REPORT" | "TEST";
    printer_id: number;
    content: string;
    status?: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED" | undefined;
    id?: string | undefined;
    retry_count?: number | undefined;
    error_message?: string | undefined;
    created_at?: string | undefined;
}>;
export type PrintJob = z.infer<typeof PrintJobSchema>;
//# sourceMappingURL=printing.d.ts.map
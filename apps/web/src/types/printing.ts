export interface Printer {
    id: number;
    name: string;
    branch_id?: number | null;
    branch_name?: string | null;
    type: string;
    target: string;
    ip_address?: string | null;
    port?: number | null;
    is_active?: number | boolean;
    display_name?: string;
    windows_printer_name?: string;
    device_id?: string;
    paper_width?: number;
}

export interface PrinterRoute {
    id: number;
    scope_type: string;
    scope_value?: string | null;
    job_type: string;
    branch_id?: number | null;
    printer_id: number;
    printer_name?: string | null;
    template_id?: number | null;
    template_name?: string | null;
    is_active?: number | boolean;
}

export interface PrintTemplate {
    id: number;
    name: string;
    type: string;
    content: string;
    is_default?: number | boolean;
    is_active?: number | boolean;
}

export interface PrintJob {
    id: string;
    printer_id: number;
    printer_name?: string | null;
    status: string;
    type: string;
    content?: string | null;
    payload?: string | null;
    template_id?: number | null;
    attempts?: number | null;
    error_message?: string | null;
    device_id?: string | null;
    locked_by?: string | null;
    locked_at?: string | null;
    processed_at?: string | null;
    retries?: number | null;
    last_error?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
    last_attempt_at?: string | null;
}

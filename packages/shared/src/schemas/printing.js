"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintJobSchema = exports.PrintJobTypeEnum = exports.PrintJobStatusEnum = exports.PrinterRouteSchema = exports.PrinterSchema = exports.PrinterTargetEnum = exports.PrinterTypeEnum = void 0;
const zod_1 = require("zod");
exports.PrinterTypeEnum = zod_1.z.enum(['NETWORK', 'USB', 'BLUETOOTH']);
exports.PrinterTargetEnum = zod_1.z.enum(['CASHIER', 'KITCHEN', 'BAR', 'LABEL']);
exports.PrinterSchema = zod_1.z.object({
    id: zod_1.z.number().optional(),
    name: zod_1.z.string(),
    type: exports.PrinterTypeEnum,
    target: exports.PrinterTargetEnum,
    ip_address: zod_1.z.string().optional(),
    port: zod_1.z.number().default(9100),
    is_active: zod_1.z.boolean().default(true),
});
exports.PrinterRouteSchema = zod_1.z.object({
    id: zod_1.z.number().optional(),
    category_id: zod_1.z.number().optional(), // If null, applies to specific items or default?
    printer_id: zod_1.z.number(),
    is_default: zod_1.z.boolean().default(false),
});
exports.PrintJobStatusEnum = zod_1.z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED']);
exports.PrintJobTypeEnum = zod_1.z.enum(['RECEIPT', 'KOT', 'REPORT', 'TEST']);
exports.PrintJobSchema = zod_1.z.object({
    id: zod_1.z.string().optional(), // UUID
    printer_id: zod_1.z.number(),
    status: exports.PrintJobStatusEnum.default('PENDING'),
    type: exports.PrintJobTypeEnum,
    content: zod_1.z.string(), // Raw ESC/POS or JSON to be parsed? Let's say JSON/Text for simulation
    retry_count: zod_1.z.number().default(0),
    error_message: zod_1.z.string().optional(),
    created_at: zod_1.z.string().optional(),
});
//# sourceMappingURL=printing.js.map
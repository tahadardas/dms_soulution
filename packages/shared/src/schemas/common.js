"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthCheckSchema = exports.ReferenceSchema = exports.IDSchema = exports.DateRangeSchema = exports.PaginatedResponseSchema = exports.PaginationParamsSchema = exports.ProblemDetailsSchema = void 0;
const zod_1 = require("zod");
exports.ProblemDetailsSchema = zod_1.z.object({
    type: zod_1.z.string().optional(),
    title: zod_1.z.string().optional(),
    status: zod_1.z.number().int().optional(),
    detail: zod_1.z.string().optional(),
    instance: zod_1.z.string().optional(),
    errors: zod_1.z.record(zod_1.z.string(), zod_1.z.array(zod_1.z.string())).optional(),
});
exports.PaginationParamsSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(10),
    search: zod_1.z.string().optional(),
    sort: zod_1.z.string().optional(),
    order: zod_1.z.enum(['asc', 'desc']).optional().default('asc'),
});
const PaginatedResponseSchema = (itemSchema) => zod_1.z.object({
    data: zod_1.z.array(itemSchema),
    meta: zod_1.z.object({
        total: zod_1.z.number().int(),
        page: zod_1.z.number().int(),
        limit: zod_1.z.number().int(),
        totalPages: zod_1.z.number().int(),
    }),
});
exports.PaginatedResponseSchema = PaginatedResponseSchema;
exports.DateRangeSchema = zod_1.z.object({
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
});
exports.IDSchema = zod_1.z.string().uuid().or(zod_1.z.number().int());
exports.ReferenceSchema = zod_1.z.object({
    id: exports.IDSchema,
    name: zod_1.z.string().optional(),
});
exports.HealthCheckSchema = zod_1.z.object({
    status: zod_1.z.literal('ok'),
    timestamp: zod_1.z.string(),
});
//# sourceMappingURL=common.js.map
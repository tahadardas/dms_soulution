import { z } from 'zod';

export const ProblemDetailsSchema = z.object({
    type: z.string().optional(),
    title: z.string().optional(),
    status: z.number().int().optional(),
    detail: z.string().optional(),
    instance: z.string().optional(),
    errors: z.record(z.string(), z.array(z.string())).optional(),
});
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;

export const PaginationParamsSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    sort: z.string().optional(),
    order: z.enum(['asc', 'desc']).optional().default('asc'),
});
export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    z.object({
        data: z.array(itemSchema),
        meta: z.object({
            total: z.number().int(),
            page: z.number().int(),
            limit: z.number().int(),
            totalPages: z.number().int(),
        }),
    });
export type PaginatedResponse<T> = {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
};

export const DateRangeSchema = z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
});
export type DateRange = z.infer<typeof DateRangeSchema>;

export const IDSchema = z.string().uuid().or(z.number().int());

export const ReferenceSchema = z.object({
    id: IDSchema,
    name: z.string().optional(),
});

export const HealthCheckSchema = z.object({
    status: z.literal('ok'),
    timestamp: z.string(),
});
export type HealthCheck = z.infer<typeof HealthCheckSchema>;

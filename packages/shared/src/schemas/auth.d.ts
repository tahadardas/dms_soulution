import { z } from 'zod';
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    username: z.ZodString;
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    username: string;
    email: string;
}, {
    id: string;
    username: string;
    email: string;
}>;
export type User = z.infer<typeof UserSchema>;
//# sourceMappingURL=auth.d.ts.map
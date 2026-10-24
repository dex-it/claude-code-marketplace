import { z } from 'zod';
import { HttpError } from './errors.js';

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive().max(99),
      }),
    )
    .min(1)
    .max(50),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    throw new HttpError(400, 'validation_error', `${where}${issue?.message ?? 'invalid body'}`);
  }
  return result.data;
}

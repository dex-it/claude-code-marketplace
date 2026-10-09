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

export const deliverySchema = z.object({
  city: z.string().trim().min(1).max(100),
  street: z.string().trim().min(1).max(200),
  recipients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        phone: z.string().regex(/^\+?[0-9 ()-]{6,20}$/),
      }),
    )
    .min(1)
    .max(5),
});

export type DeliveryInput = z.infer<typeof deliverySchema>;

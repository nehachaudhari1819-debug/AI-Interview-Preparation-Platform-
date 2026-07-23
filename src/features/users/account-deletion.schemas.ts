import { z } from "zod";

export const IdempotencyKeySchema = z
  .string({ message: "Idempotency-Key must be a string" })
  .trim()
  .min(1, { message: "Idempotency-Key cannot be empty" })
  .max(255, { message: "Idempotency-Key cannot exceed 255 characters" })
  // eslint-disable-next-line no-control-regex
  .refine((val) => !/[\x00-\x1F\x7F]/.test(val), {
    message: "Idempotency-Key contains invalid control characters",
  });

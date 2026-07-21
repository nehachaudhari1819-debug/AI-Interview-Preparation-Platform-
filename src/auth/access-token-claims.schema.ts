/* eslint-disable @typescript-eslint/no-deprecated */
import { z } from "zod";
import {
  ACCOUNT_STATUSES,
  APPLICATION_ROLES,
  AUTHENTICATOR_ASSURANCE_LEVELS,
} from "./auth.constants.js";

const optionalEmailSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().email().optional(),
);

const optionalPhoneSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
  z.string().min(1).optional(),
);

export const verifiedAccessTokenClaimsSchema = z
  .object({
    iss: z.string().url(),
    aud: z.union([z.string(), z.array(z.string()).min(1)]),
    exp: z.number().int(),
    iat: z.number().int(),
    nbf: z.number().int().optional(),
    sub: z.string().uuid(),
    role: z.string(),
    aal: z.enum(AUTHENTICATOR_ASSURANCE_LEVELS),
    session_id: z.string().uuid(),
    email: optionalEmailSchema,
    phone: optionalPhoneSchema,
    is_anonymous: z.boolean(),
    user_role: z.enum(APPLICATION_ROLES).optional(),
    account_status: z.enum(ACCOUNT_STATUSES).exclude(["unknown"]).optional(),
    app_metadata: z.record(z.string(), z.unknown()).optional(),
    user_metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export type VerifiedAccessTokenClaims = z.infer<typeof verifiedAccessTokenClaimsSchema>;

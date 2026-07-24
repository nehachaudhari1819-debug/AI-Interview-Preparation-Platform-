import { z } from "zod";

export const accountAccessStateSchema = z.enum(["active", "disabled", "deleted", "missing"]);

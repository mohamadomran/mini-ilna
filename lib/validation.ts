import { z } from "zod";

export const TenantCreateSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  website: z.url(),
});

export type TenantCreateSchema = z.infer<typeof TenantCreateSchema>;

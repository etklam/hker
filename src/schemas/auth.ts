import { z } from "zod";
export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").max(255),
  password: z.string().min(1, "Password is required").max(4096),
});

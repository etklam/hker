import type { AuthUser } from "@/lib/types";
export function isAdmin(role: AuthUser["role"]) {
  return role === "admin" || role === "superadmin";
}

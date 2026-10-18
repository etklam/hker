export interface AuthUser {
  id: number;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin" | "superadmin";
}

export interface SessionResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

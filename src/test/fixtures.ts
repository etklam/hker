import type { AuthUser } from "@/lib/types";

export const mockUser: AuthUser = {
  id: 1,
  email: "test@example.com",
  displayName: "Test User",
  avatarUrl: null,
  role: "user",
};

export const mockAdmin: AuthUser = {
  id: 2,
  email: "admin@example.com",
  displayName: "Admin",
  avatarUrl: null,
  role: "admin",
};

export const mockAuthIdentity = {
  id: 1,
  userId: 1,
  provider: "password",
  providerSubject: "test@example.com",
  passwordHash:
    "aabbccdd:eeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccdd",
  email: "test@example.com",
  emailVerified: false,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
  lastUsedAt: null,
};

export const mockSession = {
  id: 1,
  userId: 1,
  tokenHash: "abc123",
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date("2025-01-01"),
  lastSeenAt: new Date("2025-01-01"),
};

export const mockDbUser = {
  id: 1,
  email: "test@example.com",
  displayName: "Test User",
  avatarUrl: null,
  role: "user" as const,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

export function createMockRequest(
  options: {
    url?: string;
    method?: string;
    body?: unknown;
    cookies?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
) {
  const url = new URL(options.url ?? "http://localhost:3000/api/test");
  const headers = new Headers();
  if (options.headers) {
    for (const [k, v] of Object.entries(options.headers)) {
      headers.set(k, v);
    }
  }
  const cookies = options.cookies ?? {};
  return {
    url: url.toString(),
    method: options.method ?? "GET",
    headers,
    json: () => Promise.resolve(options.body ?? {}),
    cookies: {
      get: (name: string) =>
        cookies[name] ? { value: cookies[name] } : undefined,
    },
    nextUrl: url,
  } as any;
}

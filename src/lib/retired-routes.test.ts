import { describe, expect, it } from "vitest";
import { isRetiredPath, retiredPaths } from "./retired-routes";
import * as registration from "@/app/api/auth/register/[[...path]]/route";
import * as bills from "@/app/(retired)/bills/[[...path]]/route";
import * as featured from "@/app/api/featured/[[...path]]/route";
import { db } from "@/server/db";

describe("retired server entry points", () => {
  it("denies every retired subtree without intercepting active siblings", () => {
    for (const path of retiredPaths) {
      expect(isRetiredPath(path)).toBe(true);
      expect(isRetiredPath(`${path}/child/deep`)).toBe(true);
      expect(isRetiredPath(`${path}-new`)).toBe(false);
    }
    for (const path of ["/api/admin/catalog", "/api/auth/login", "/api/catalog", "/api/telegram/webhook"])
      expect(isRetiredPath(path)).toBe(false);
  });
  it("all methods deny directly without database access", () => {
    const previous = vi.mocked(db.select).mock.calls.length;
    for (const route of [registration, bills, featured]) {
      for (const method of ["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"] as const) {
        const response = route[method]();
        expect(response.status).toBe(410);
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    }
    expect(vi.mocked(db.select).mock.calls.length).toBe(previous);
  });
});

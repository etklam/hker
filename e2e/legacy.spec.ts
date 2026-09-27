import { test, expect } from "@playwright/test";
import { retiredPaths } from "../src/lib/retired-routes";
for (const path of retiredPaths) test(`retired boundary ${path}`, async ({ request }) => {
  for (const suffix of ["", "/child/deep"]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const response = await request.fetch(`${path}${suffix}`, { method });
      expect(response.status()).toBe(410);
      expect(response.headers()["cache-control"]).toBe("no-store");
    }
  }
});

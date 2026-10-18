import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppError } from "@/lib/errors";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

const { CATALOG_TAG, catalogMutation, revalidateCatalog } =
  await import("./cache");

describe("catalog cache invalidation", () => {
  beforeEach(() => revalidateTag.mockClear());

  it("drops the catalog tag once a mutation resolves", async () => {
    const response = await catalogMutation(async () => ({ id: 7 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: 7 });
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(CATALOG_TAG);
  });

  it("keeps the cache when the mutation is rejected", async () => {
    const response = await catalogMutation(async () => {
      throw new AppError("CONFLICT", "資料正被其他操作更新");
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("keeps the cache when the mutation fails unexpectedly", async () => {
    const response = await catalogMutation(async () => {
      throw Object.assign(new Error("deadlock"), { code: "40P01" });
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("invalidates every public read through a single tag", () => {
    revalidateCatalog();
    expect(revalidateTag).toHaveBeenCalledExactlyOnceWith(CATALOG_TAG);
  });
});

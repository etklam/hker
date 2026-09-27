import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminCatalog } from "./AdminCatalog";

const taxonomy = {
  categories: [],
  areas: [],
  tags: [],
  groups: [],
  navigation: [],
};

const listingResult = (name: string) => ({
  items: [
    {
      id: name === "新結果" ? 2 : 1,
      revision: 1,
      name,
      slug: name === "新結果" ? "new" : "old",
      enabled: false,
      sortOrder: 0,
      priceMin: null,
      priceMax: null,
      tags: [],
      links: [],
      attrs: {},
      aliases: [],
      updatedAt: new Date(0).toISOString(),
    },
  ],
  total: 1,
  totalPages: 1,
});

afterEach(() => vi.unstubAllGlobals());

describe("admin catalog loading", () => {
  it.each([
    ["categories", ["/api/admin/catalog?taxonomy=1"]],
    ["settings", ["/api/admin/catalog?settings=1"]],
  ] as const)("does not fetch listings for %s", async (section, expected) => {
    const fetch = vi.fn().mockResolvedValue(Response.json(
      section === "settings"
        ? {
            publicUrlConfigured: false,
            telegramConfigured: false,
            webhookProtected: false,
          }
        : taxonomy,
    ));
    vi.stubGlobal("fetch", fetch);
    render(<AdminCatalog section={section} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(expected.length));
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(expected);
  });

  it("ignores an older listing response that finishes after a newer search", async () => {
    let resolveOld!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => {
      resolveOld = resolve;
    });
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(taxonomy))
      .mockReturnValueOnce(oldResponse)
      .mockResolvedValueOnce(Response.json(taxonomy))
      .mockResolvedValueOnce(Response.json(listingResult("新結果")));
    vi.stubGlobal("fetch", fetch);
    render(<AdminCatalog section="listings" />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByRole("textbox", { name: "搜尋收錄" }), {
      target: { value: "new" },
    });
    fireEvent.click(screen.getByRole("button", { name: "搜尋" }));
    expect(await screen.findByText("新結果")).toBeInTheDocument();
    await act(async () => resolveOld(Response.json(listingResult("舊結果"))));
    expect(screen.queryByText("舊結果")).not.toBeInTheDocument();
    expect(screen.getByText("新結果")).toBeInTheDocument();
  });
});

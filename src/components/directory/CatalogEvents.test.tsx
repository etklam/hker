import { act, render, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogEvents } from "./CatalogEvents";

afterEach(() => vi.unstubAllGlobals());
describe("observed discovery events", () => {
  const receipt = {
    actionId: "640814d4-f921-45f3-a373-68444b8050d3",
    occurredAt: "2026-09-27T10:00:00.000Z",
    signature: "a".repeat(64),
  };
  const posts = (fetch: ReturnType<typeof vi.fn>) =>
    fetch.mock.calls.filter(([, options]) => options?.method === "POST");

  it("counts submitted searches and tagged clicks, but not rendering or pagination", async () => {
    const fetch = vi.fn().mockImplementation((_url, options) =>
      Promise.resolve(options?.method === "POST" ? { ok: true, status: 200 } : { ok: true, json: async () => receipt }),
    );
    vi.stubGlobal("fetch", fetch);
    const { container } = render(
      <>
        <CatalogEvents />
        <form action="/search" onSubmit={(event) => event.preventDefault()}>
          <input name="q" defaultValue="手機" />
          <input name="categoryId" defaultValue="1" />
          <input name="featured" defaultValue="" />
        </form>
        <a href="#next">下一頁</a>
        <a href="#tag" data-catalog-kind="tag" data-catalog-key="7">
          手機標籤
        </a>
      </>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fetch.mockClear();
    fireEvent.click(screen.getByText("下一頁"));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(posts(fetch)).toHaveLength(1));
    expect(JSON.parse(posts(fetch)[0][1].body)).toMatchObject({
      kind: "search",
      key: "手機",
      source: "web",
      search: { categoryId: 1 },
      receipt,
    });
    fireEvent.click(screen.getByText("手機標籤"));
    await waitFor(() => expect(posts(fetch)).toHaveLength(2));
    expect(JSON.parse(posts(fetch)[1][1].body)).toMatchObject({
      kind: "tag",
      key: "7",
    });
  });

  it("counts an explicit structured discovery without inventing a query label", async () => {
    const fetch = vi.fn().mockImplementation((_url, options) =>
      Promise.resolve(options?.method === "POST" ? { ok: true, status: 200 } : { ok: true, json: async () => receipt }),
    );
    vi.stubGlobal("fetch", fetch);
    const { container } = render(
      <>
        <CatalogEvents />
        <form action="/search" onSubmit={(event) => event.preventDefault()}>
          <input name="q" defaultValue="" />
          <input name="areaId" defaultValue="9" />
        </form>
      </>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    fetch.mockClear();
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(posts(fetch)).toHaveLength(1));
    expect(JSON.parse(posts(fetch)[0][1].body)).toMatchObject({
      kind: "filter",
      key: "applied",
      search: { query: "", areaId: 9 },
    });
  });

  it("keeps a submitted search while its signed receipt is still arriving", async () => {
    let resolveReceipt: (() => void) | undefined;
    const fetch = vi.fn().mockImplementation((_url, options) => {
      if (options?.method === "POST")
        return Promise.resolve({ ok: true, status: 200 });
      return new Promise((resolve) => {
        resolveReceipt = () =>
          resolve({ ok: true, json: async () => receipt });
      });
    });
    vi.stubGlobal("fetch", fetch);
    const { container, unmount } = render(
      <>
        <CatalogEvents />
        <form action="/search" onSubmit={(event) => event.preventDefault()}>
          <input name="q" defaultValue="即時搜尋" />
        </form>
      </>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fireEvent.submit(container.querySelector("form")!);
    unmount();
    expect(posts(fetch)).toHaveLength(0);
    await act(async () => resolveReceipt?.());

    await waitFor(() => expect(posts(fetch)).toHaveLength(1));
    expect(JSON.parse(posts(fetch)[0][1].body)).toMatchObject({
      kind: "search",
      key: "即時搜尋",
      receipt,
    });
  });
});

import {
  act,
  render,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogEvents, CatalogSearchObservation } from "./CatalogEvents";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
describe("observed discovery events", () => {
  const receipt = {
    version: 1 as const,
    purpose: "catalog-navigation" as const,
    source: "web" as const,
    actionId: "640814d4-f921-45f3-a373-68444b8050d3",
    occurredAt: "2026-09-27T10:00:00.000Z",
    signature: "a".repeat(64),
  };
  const observation = {
    version: 1 as const,
    purpose: "catalog-search-observation" as const,
    source: "web" as const,
    actionId: "740814d4-f921-45f3-a373-68444b8050d3",
    observedAt: "2026-09-27T10:00:00.000Z",
    criteriaDigest: "b".repeat(64),
    resultCount: 0,
    signature: "c".repeat(64),
  };
  const posts = (fetch: ReturnType<typeof vi.fn>) =>
    fetch.mock.calls.filter(([, options]) => options?.method === "POST");

  it("posts the rendered search observation once and keeps navigation separate", async () => {
    const fetch = vi
      .fn()
      .mockImplementation((_url, options) =>
        Promise.resolve(
          options?.method === "POST"
            ? { ok: true, status: 200 }
            : { ok: true, json: async () => receipt },
        ),
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
    expect(posts(fetch)).toHaveLength(0);
    expect(sessionStorage.getItem("hker:catalog-search-submit")).not.toContain(
      "手機",
    );
    history.pushState(
      {},
      "",
      "/search?q=%E6%89%8B%E6%A9%9F&categoryId=1&featured=",
    );
    render(
      <CatalogSearchObservation
        kind="search"
        eventKey="手機"
        search={{ query: "手機", categoryId: 1 }}
        observation={observation}
      />,
    );
    await waitFor(() => expect(posts(fetch)).toHaveLength(1));
    expect(JSON.parse(posts(fetch)[0][1].body)).toMatchObject({
      kind: "search",
      key: "手機",
      source: "web",
      search: { categoryId: 1 },
      observation,
    });
    fireEvent.click(screen.getByText("手機標籤"));
    await waitFor(() => expect(posts(fetch)).toHaveLength(2));
    expect(JSON.parse(posts(fetch)[1][1].body)).toMatchObject({
      kind: "tag",
      key: "7",
    });
  });

  it("counts an explicit structured discovery without inventing a query label", async () => {
    const fetch = vi
      .fn()
      .mockImplementation((_url, options) =>
        Promise.resolve(
          options?.method === "POST"
            ? { ok: true, status: 200 }
            : { ok: true, json: async () => receipt },
        ),
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
    expect(posts(fetch)).toHaveLength(0);
    history.pushState({}, "", "/search?q=&areaId=9");
    render(
      <CatalogSearchObservation
        kind="filter"
        eventKey="applied"
        search={{ query: "", areaId: 9 }}
        observation={{ ...observation, resultCount: 4 }}
      />,
    );
    await waitFor(() => expect(posts(fetch)).toHaveLength(1));
    expect(JSON.parse(posts(fetch)[0][1].body)).toMatchObject({
      kind: "filter",
      key: "applied",
      search: { query: "", areaId: 9 },
    });
  });

  it("keeps a tagged click while its signed receipt is still arriving", async () => {
    let resolveReceipt: (() => void) | undefined;
    const fetch = vi.fn().mockImplementation((_url, options) => {
      if (options?.method === "POST")
        return Promise.resolve({ ok: true, status: 200 });
      return new Promise((resolve) => {
        resolveReceipt = () => resolve({ ok: true, json: async () => receipt });
      });
    });
    vi.stubGlobal("fetch", fetch);
    const { container, unmount } = render(
      <>
        <CatalogEvents />
        <a href="#tag" data-catalog-kind="tag" data-catalog-key="8">
          即時標籤
        </a>
      </>,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText("即時標籤"));
    unmount();
    expect(posts(fetch)).toHaveLength(0);
    await act(async () => resolveReceipt?.());

    await waitFor(() => expect(posts(fetch)).toHaveLength(1));
    expect(JSON.parse(posts(fetch)[0][1].body)).toMatchObject({
      kind: "tag",
      key: "8",
      receipt,
    });
  });

  it("allows search submission when browser measurement storage is unavailable", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => receipt,
    });
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    const { container } = render(
      <>
        <CatalogEvents />
        <form action="/search" onSubmit={(event) => event.preventDefault()}>
          <input name="q" defaultValue="仍可搜尋" />
        </form>
      </>,
    );

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(() =>
      fireEvent.submit(container.querySelector("form")!),
    ).not.toThrow();
    expect(posts(fetch)).toHaveLength(0);
  });
});

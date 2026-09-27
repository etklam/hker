import { render, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogEvents } from "./CatalogEvents";

afterEach(() => vi.unstubAllGlobals());
describe("observed discovery events", () => {
  it("counts submitted searches and tagged clicks, but not rendering or pagination", () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
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
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("下一頁"));
    expect(fetch).not.toHaveBeenCalled();
    fireEvent.submit(container.querySelector("form")!);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      kind: "search",
      key: "手機",
      source: "web",
      search: { categoryId: 1 },
    });
    fireEvent.click(screen.getByText("手機標籤"));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
      kind: "tag",
      key: "7",
    });
  });
});

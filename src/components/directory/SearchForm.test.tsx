import { render, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchForm } from "./SearchForm";
import { TagPicker } from "./TagPicker";
import type { Taxonomy } from "@/server/catalog/service";

describe("search page state", () => {
  it("preserves the page for unchanged OR conditions and resets on edits", () => {
    const { container } = render(
      <SearchForm
        input={{
          query: "測試",
          tagIds: [1],
          tagMatchMode: "or",
          sort: "manual",
          page: 3,
        }}
      >
        <input name="q" defaultValue="測試" />
        <input name="tagIds" defaultValue="1" />
        <input name="tagMatchMode" defaultValue="or" />
        <input name="sort" defaultValue="manual" />
      </SearchForm>,
    );
    const form = container.querySelector("form")!;
    const query = container.querySelector<HTMLInputElement>('[name="q"]')!;
    fireEvent.submit(form);
    expect(container.querySelector('[name="page"]')).toHaveValue("3");
    fireEvent.change(query, { target: { value: "另一搜尋" } });
    fireEvent.submit(form);
    expect(container.querySelector('[name="page"]')).toHaveValue("1");
  });
  it("restores URL-resolved controls after browser history restores stale native values", async () => {
    const { container, rerender } = render(
      <SearchForm input={{ featured: true, tagMatchMode: "or", page: 2 }}>
        <select name="featured" defaultValue="true">
          <option value="">全部</option>
          <option value="true">精選</option>
        </select>
        <select name="tagMatchMode" defaultValue="or">
          <option value="and">AND</option>
          <option value="or">OR</option>
        </select>
      </SearchForm>,
    );
    const select =
      container.querySelector<HTMLSelectElement>('[name="featured"]')!;
    select.value = "";
    window.dispatchEvent(new Event("pageshow"));
    await waitFor(() => expect(select).toHaveValue("true"));
    select.value = "";
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(select).toHaveValue("true"));
    rerender(
      <SearchForm input={{ featured: undefined, tagMatchMode: "or", page: 1 }}>
        <select name="featured" defaultValue="">
          <option value="">全部</option>
          <option value="true">精選</option>
        </select>
      </SearchForm>,
    );
    expect(container.querySelector('[name="featured"]')).toHaveValue("");
    expect(container.querySelector('[name="page"]')).toHaveValue("1");
  });
  it("does not reset controlled tag selections when restoring native controls", async () => {
    const taxonomy = {
      categories: [],
      areas: [],
      navigation: [],
      groups: [],
      tags: [
        { id: 1, name: "手機", aliases: [], groupId: null, filterable: true },
      ],
    } as Taxonomy;
    const { container, getByRole } = render(
      <SearchForm input={{ featured: true, tagIds: [] }}>
        <select name="featured" defaultValue="true">
          <option value="">全部</option>
          <option value="true">精選</option>
        </select>
        <TagPicker taxonomy={taxonomy} selected={[]} />
      </SearchForm>,
    );
    fireEvent.click(getByRole("checkbox"));
    const select =
      container.querySelector<HTMLSelectElement>('[name="featured"]')!;
    select.value = "";
    window.dispatchEvent(new Event("pageshow"));
    await waitFor(() => expect(select).toHaveValue("true"));
    expect(getByRole("checkbox")).toBeChecked();
    expect(container.querySelector('[name="tagIds"]')).toHaveValue("1");
  });
});

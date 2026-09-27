import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { Editor } from "./Editor";
const taxonomy = {
  categories: [],
  areas: [],
  tags: [],
  groups: [],
  navigation: [],
};
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
});
describe("catalog editor conflicts", () => {
  it("restores focus to an explicit opener after the modal unmounts", async () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    const { unmount } = render(
      <Editor
        kind="categories"
        initial={{ name: "分類", slug: "category" }}
        taxonomy={taxonomy}
        returnFocus={opener}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    unmount();

    await waitFor(() => expect(opener).toHaveFocus());
    opener.remove();
  });

  it("preserves a draft and link identity after a stale revision rejection", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ message: "版本衝突" }),
      });
    vi.stubGlobal("fetch", fetch);
    const saved = vi.fn();
    render(
      <Editor
        kind="listings"
        initial={{
          id: 8,
          revision: 2,
          name: "原名稱",
          slug: "old",
          links: [
            {
              id: 71,
              type: "website",
              label: "網站",
              url: "https://example.com",
              sortOrder: 0,
              enabled: true,
            },
          ],
        }}
        taxonomy={taxonomy}
        onClose={vi.fn()}
        onSaved={saved}
      />,
    );
    fireEvent.change(screen.getByLabelText("名稱"), {
      target: { value: "草稿名稱" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("你的草稿已保留"),
    );
    expect(screen.getByLabelText("名稱")).toHaveValue("草稿名稱");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.data.revision).toBe(2);
    expect(body.data.links[0].id).toBe(71);
    expect(saved).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("keeps the draft and explains recovery after session expiry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: "Authentication required" }),
      }),
    );
    render(
      <Editor
        kind="categories"
        initial={{ id: 2, name: "原分類", slug: "original" }}
        taxonomy={taxonomy}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("名稱"), {
      target: { value: "保留的分類草稿" },
    });
    fireEvent.click(screen.getByRole("button", { name: "儲存" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("另一個分頁重新登入"),
    );
    expect(screen.getByLabelText("名稱")).toHaveValue("保留的分類草稿");
    vi.unstubAllGlobals();
  });
});

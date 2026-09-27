import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TagPicker } from "./TagPicker";
import type { Taxonomy } from "@/server/catalog/service";
const taxonomy = {
  categories: [],
  areas: [],
  navigation: [],
  groups: [{ id: 1, name: "飲食" }],
  tags: [
    {
      id: 1,
      name: "早餐",
      aliases: ["breakfast"],
      groupId: 1,
      filterable: true,
      enabled: true,
      publicVisible: true,
      botVisible: false,
    },
    {
      id: 2,
      name: "晚餐",
      aliases: [],
      groupId: null,
      filterable: true,
      enabled: true,
      publicVisible: true,
      botVisible: true,
    },
  ],
} as Taxonomy;
describe("TagPicker", () => {
  it("searches aliases without dropping selected form values", () => {
    const { container } = render(
      <TagPicker taxonomy={taxonomy} selected={[2]} />,
    );
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "BREAKFAST" },
    });
    expect(screen.getByText("早餐")).toBeInTheDocument();
    expect(screen.queryByText("晚餐")).not.toBeInTheDocument();
    expect(container.querySelector('input[name="tagIds"]')).toHaveValue("2");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(container.querySelectorAll('input[name="tagIds"]')).toHaveLength(2);
  });
  it("keeps individually visible tags reachable when their group is hidden", () => {
    render(<TagPicker taxonomy={{ ...taxonomy, groups: [] }} selected={[]} />);
    expect(screen.getByText("早餐")).toBeInTheDocument();
  });
  it("shows visibility in admin selection", () => {
    render(<TagPicker taxonomy={taxonomy} selected={[]} admin />);
    expect(screen.getByText(/Bot 隱藏/)).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsPanel } from "./AnalyticsPanel";

afterEach(() => vi.unstubAllGlobals());

const report = {
  rows: [],
  summary: {
    searches: 0,
    zeroResults: 0,
    zeroRate: null,
    filteredDiscoveries: 0,
    suppressedSearches: 0,
  },
  collection: {
    status: "enabled",
    timeZone: "Asia/Hong_Kong",
    retentionDays: 90,
    collectionStart: null,
    todayIncomplete: true,
  },
  meaning: "觀察到的操作次數。",
};

describe("analytics operator view", () => {
  it("filters by source and distinguishes an enabled empty range", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => report });
    vi.stubGlobal("fetch", fetch);
    render(<AnalyticsPanel />);
    expect(await screen.findByText(/尚未收集事件/)).toBeInTheDocument();
    expect(screen.getByText(/尚未有獲准的探索操作/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("來源"), { target: { value: "web" } });
    await waitFor(() =>
      expect(fetch.mock.calls.at(-1)?.[0]).toContain("source=web"),
    );
  });

  it("does not present disabled collection as zero demand", async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...report,
        collection: { ...report.collection, status: "disabled" },
      }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<AnalyticsPanel />);
    expect(await screen.findByText(/探索統計目前已停用/)).toBeInTheDocument();
    expect(screen.queryByText("已提交文字搜尋")).not.toBeInTheDocument();
  });

  it("inspects current public results without mixing them into historical counts", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("inspect="))
        return Response.json({
          query: "流動維修",
          total: 3,
          inspectedAt: "2026-09-28T04:05:06.000Z",
        });
      return Response.json({
        ...report,
        rows: [
          {
            source: "web",
            kind: "search",
            key: "流動維修",
            label: "流動維修",
            count: 12,
            zeroCount: 7,
            queryLabelEligible: true,
          },
        ],
      });
    });
    vi.stubGlobal("fetch", fetch);
    render(<AnalyticsPanel />);

    expect(await screen.findByText("12")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "查看目前結果" }));
    expect(await screen.findByText("3 項")).toBeInTheDocument();
    expect(screen.getByText(/檢查時間/)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "編輯相關標籤" })).toHaveAttribute(
      "href",
      "/admin/tags",
    );
    expect(screen.getByRole("link", { name: "建立收錄草稿" })).toHaveAttribute(
      "href",
      "/admin/listings",
    );
    expect(fetch.mock.calls.at(-1)?.[0]).toBe(
      "/api/admin/analytics?inspect=%E6%B5%81%E5%8B%95%E7%B6%AD%E4%BF%AE",
    );
  });
});

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
});

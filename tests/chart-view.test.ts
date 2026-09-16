// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { ProcessedCusumRecord } from "../src/core";
import { MAX_PRACTICAL_CHART_SERIES, renderChartView } from "../src/ui/chart-view";

describe("chart practical-series guidance", () => {
  it("requires an explicit smaller selection instead of silently dropping series", () => {
    const canvas = document.createElement("canvas");
    const summary = document.createElement("p");
    const empty = document.createElement("p");
    const guidance = document.createElement("p");
    const chart = { render: vi.fn(), clear: vi.fn() };
    const records = Array.from({ length: MAX_PRACTICAL_CHART_SERIES + 1 }, (_, index) =>
      record(`Area ${index + 1}`));
    renderChartView({ canvas, summary, empty, guidance }, records, 3, chart, 36, "monthly");
    expect(chart.render).not.toHaveBeenCalled();
    expect(chart.clear).toHaveBeenCalledOnce();
    expect(summary.textContent).toContain(`Select ${MAX_PRACTICAL_CHART_SERIES} or fewer`);
    expect(summary.textContent).toContain("no records are sampled or discarded");
    expect(canvas.hidden).toBe(true);
  });

  it("explains an empty series selection", () => {
    const canvas = document.createElement("canvas");
    const summary = document.createElement("p");
    const empty = document.createElement("p");
    const guidance = document.createElement("p");
    const chart = { render: vi.fn(), clear: vi.fn() };
    renderChartView({ canvas, summary, empty, guidance }, [], 3, chart, 36, "monthly");
    expect(summary.textContent).toContain("Select a series or reset the filters");
    expect(empty.textContent).toContain("no visible series");
  });

  it("describes a settings-driven initial baseline period without hiding values", () => {
    const canvas = document.createElement("canvas");
    const summary = document.createElement("p");
    const empty = document.createElement("p");
    const guidance = document.createElement("p");
    const chart = { render: vi.fn(), clear: vi.fn() };
    const records = [record("Area A")];

    renderChartView({ canvas, summary, empty, guidance }, records, 3, chart, 12, "weekly");

    expect(guidance.textContent).toContain("first 12 weekly intervals");
    expect(guidance.textContent).toContain("All data, CUSUM values, and alert points remain visible");
    expect(summary.textContent).toContain("all chart values remain visible");
  });
});

function record(area: string): ProcessedCusumRecord {
  return {
    area,
    date: "2024-01-01",
    count: 1,
    smoothed_count: 1,
    baseline_mean: 1,
    baseline_std: 1,
    normalized_count: 0,
    cusum: 0,
    threshold: 3,
    is_alert: false,
  };
}

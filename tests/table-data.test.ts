import { describe, expect, it } from "vitest";
import type { ProcessedCusumRecord } from "../src/core";
import {
  formatCusumForDisplay,
  formatNormalizedCountForDisplay,
  paginateRecords,
} from "../src/results";

describe("result table data", () => {
  it("paginates without mutating the source records", () => {
    const records = Array.from({ length: 60 }, (_, index) => record("A", `2024-01-${index}`, false));
    const page = paginateRecords(records, 2, 25);
    expect(page.records).toHaveLength(25);
    expect(page.range_start).toBe(26);
    expect(page.range_end).toBe(50);
    expect(records).toHaveLength(60);
  });

  it("clamps pages and reports an empty range", () => {
    expect(paginateRecords([], 99, 25)).toMatchObject({
      page: 1,
      total_pages: 1,
      range_start: 0,
      range_end: 0,
    });
  });

  it("formats CUSUM to two decimals without changing its stored precision", () => {
    const cusum = 19.079492;
    expect(formatCusumForDisplay(cusum)).toBe("19.08");
    expect(cusum).toBe(19.079492);
  });

  it.each([
    [0.166667, "0.17"],
    [-0.121716, "-0.12"],
    [0.408248, "0.41"],
    [0.818923, "0.82"],
    [0, "0.00"],
  ])("formats normalized count %s as %s for display only", (value, expected) => {
    expect(formatNormalizedCountForDisplay(value)).toBe(expected);
  });
});

function record(area: string, date: string, alert: boolean, riskGroup?: string): ProcessedCusumRecord {
  return {
    area,
    ...(riskGroup === undefined ? {} : { risk_group: riskGroup }),
    date,
    count: 1,
    smoothed_count: 1,
    baseline_mean: 1,
    baseline_std: 1,
    normalized_count: 0,
    cusum: alert ? 4 : 0,
    threshold: 3,
    is_alert: alert,
  };
}

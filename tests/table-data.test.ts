import { describe, expect, it } from "vitest";
import type { ProcessedCusumRecord } from "../src/core";
import { paginateRecords, sortAlertRecords } from "../src/results";

describe("result table data", () => {
  it("sorts alerts by date descending, then area and risk group", () => {
    const records = [
      record("B", "2024-01-01", true),
      record("A", "2024-01-02", true, "Z"),
      record("A", "2024-01-02", true, "A"),
      record("A", "2024-01-03", false),
    ];
    expect(sortAlertRecords(records).map((item) => `${item.date}/${item.area}/${item.risk_group ?? ""}`)).toEqual([
      "2024-01-02/A/A",
      "2024-01-02/A/Z",
      "2024-01-01/B/",
    ]);
  });

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


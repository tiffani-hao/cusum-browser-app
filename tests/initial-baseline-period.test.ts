// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { ProcessedCusumRecord } from "../src/core";
import {
  initialBaselinePeriodRecordKeys,
  isInitialBaselinePeriodRecord,
} from "../src/results";
import { renderAlertTable } from "../src/ui/alert-table-view";
import { renderProcessedTable } from "../src/ui/processed-table-view";

describe("initial baseline-period presentation", () => {
  it("selects the configured number of chronological intervals independently for every series", () => {
    const records = [
      record("Monthly", "2024-04-01", 4),
      record("Monthly", "2024-02-01", 2),
      record("Daily", "2024-01-04", 4),
      record("Weekly", "2024-01-22", 4, "Group 1"),
      record("Daily", "2024-01-01", 1),
      record("Monthly", "2024-01-01", 1),
      record("Weekly", "2024-01-01", 1, "Group 1"),
      record("Daily", "2024-01-03", 3),
      record("Weekly", "2024-01-15", 3, "Group 1"),
      record("Monthly", "2024-03-01", 3),
      record("Daily", "2024-01-02", 2),
      record("Weekly", "2024-01-08", 2, "Group 1"),
    ];
    const keys = initialBaselinePeriodRecordKeys(records, 2);

    expect(keys).toHaveLength(6);
    expect(isInitialBaselinePeriodRecord(records[0]!, keys)).toBe(false);
    expect(isInitialBaselinePeriodRecord(records[2]!, keys)).toBe(false);
    expect(isInitialBaselinePeriodRecord(records[3]!, keys)).toBe(false);
    expect(isInitialBaselinePeriodRecord(records[1]!, keys)).toBe(true);
    expect(isInitialBaselinePeriodRecord(records[4]!, keys)).toBe(true);
    expect(isInitialBaselinePeriodRecord(records[6]!, keys)).toBe(true);
  });

  it("uses all 36 monthly periods from the HIV baseline setting", () => {
    const records = Array.from({ length: 40 }, (_, index) =>
      record("Area A", `${2022 + Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}-01`, index)
    );
    const keys = initialBaselinePeriodRecordKeys(records, 36);

    expect(keys).toHaveLength(36);
    expect(isInitialBaselinePeriodRecord(records[35]!, keys)).toBe(true);
    expect(isInitialBaselinePeriodRecord(records[36]!, keys)).toBe(false);
  });

  it("keeps calculated values and alert status visible in the processed table", () => {
    const records = [1, 2, 3, 4].map((month) =>
      record("Area A", `2024-${String(month).padStart(2, "0")}-01`, month, "Group 1", true)
    );
    const original = structuredClone(records);
    const container = document.createElement("div");
    renderProcessedTable(
      container,
      records,
      1,
      25,
      { setPage: vi.fn(), setPageSize: vi.fn() },
    );

    const firstCells = [...container.querySelectorAll("tbody tr")[0]!.querySelectorAll("td")]
      .map((cell) => cell.textContent);
    expect(firstCells).toEqual([
      "Area A",
      "Group 1",
      "2024-01-01",
      "1",
      "0",
      "1",
      "3",
      "Alert",
    ]);
    expect(records).toEqual(original);
  });

  it("keeps alerts from the initial baseline period in the alert table", () => {
    const records = [1, 2, 3, 4].map((month) =>
      record("Area A", `2024-${String(month).padStart(2, "0")}-01`, month, undefined, true)
    );
    const container = document.createElement("div");
    renderAlertTable(
      container,
      records,
      1,
      25,
      true,
      { setPage: vi.fn(), setExpanded: vi.fn() },
    );

    expect(container.querySelectorAll("tbody tr")).toHaveLength(4);
    expect(container.textContent).toContain("2024-01-01");
  });
});

function record(
  area: string,
  date: string,
  value: number,
  riskGroup?: string,
  isAlert = false,
): ProcessedCusumRecord {
  return {
    area,
    ...(riskGroup === undefined ? {} : { risk_group: riskGroup }),
    date,
    count: value,
    smoothed_count: value,
    baseline_mean: 1,
    baseline_std: 1,
    normalized_count: value - 1,
    cusum: value,
    threshold: 3,
    is_alert: isAlert,
  };
}

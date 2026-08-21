// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import type { ProcessedCusumRecord } from "../src/core";
import {
  downloadProcessedCsv,
  escapeCsvCell,
  exportFilename,
  sanitizeSpreadsheetString,
  serializeProcessedCsv,
} from "../src/results";

describe("processed-result CSV serialization", () => {
  it.each([
    ["=SUM(A1:A2)", "'=SUM(A1:A2)"],
    ["+cmd", "'+cmd"],
    ["-formula", "'-formula"],
    ["@value", "'@value"],
    ["  =SUM(A1)", "'  =SUM(A1)"],
  ])("neutralizes spreadsheet formula strings %s", (input, expected) => {
    expect(sanitizeSpreadsheetString(input)).toBe(expected);
  });

  it("escapes quotes, commas, and newlines", () => {
    expect(escapeCsvCell('A, "quoted"\nvalue')).toBe('"A, ""quoted""\nvalue"');
  });

  it("does not sanitize numeric negative values", () => {
    expect(escapeCsvCell(-1.25)).toBe("-1.25");
  });

  it("includes deterministic headers and full number precision", () => {
    const csv = serializeProcessedCsv([record("Area A", 0.123456789012345)]);
    expect(csv.split("\r\n")[0]).toBe(
      "area,date,count,smoothed_count,baseline_mean,baseline_std,normalized_count,cusum,threshold,is_alert",
    );
    expect(csv).toContain("0.123456789012345");
  });

  it("includes risk_group only when present", () => {
    expect(serializeProcessedCsv([{ ...record("A", 1), risk_group: "High" }]).split("\r\n")[0])
      .toContain("area,risk_group,date");
  });
});

describe("local CSV download", () => {
  it("uses a neutral deterministic filename", () => {
    expect(exportFilename("alerts", "weekly", new Date("2026-07-23T10:00:00Z")))
      .toBe("cusum-alerts-weekly-2026-07-23.csv");
  });

  it("creates a temporary link and always revokes the object URL", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const createObjectURL = vi.fn(() => "blob:local-result");
    const revokeObjectURL = vi.fn();
    const filename = downloadProcessedCsv(
      [record("A", 1)],
      "processed-results",
      "daily",
      new Date("2026-07-23T10:00:00Z"),
      { document, createObjectURL, revokeObjectURL },
    );
    expect(filename).toBe("cusum-processed-results-daily-2026-07-23.csv");
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-result");
    expect(document.querySelector('a[download]')).toBeNull();
  });
});

function record(area: string, cusum: number): ProcessedCusumRecord {
  return {
    area,
    date: "2024-01-01",
    count: 1,
    smoothed_count: 1,
    baseline_mean: 1,
    baseline_std: 1,
    normalized_count: 0,
    cusum,
    threshold: 3,
    is_alert: false,
  };
}

import { describe, expect, it } from "vitest";
import { nextPeriod, parseIsoDate, standardizeDate } from "../src/core";

describe("deterministic UTC date handling", () => {
  it("preserves daily dates", () => {
    expect(standardizeDate("2024-03-10", "daily")).toBe("2024-03-10");
  });

  it("anchors weeks to Monday", () => {
    expect(standardizeDate("2024-01-07", "weekly")).toBe("2024-01-01");
    expect(standardizeDate("2024-01-08", "weekly")).toBe("2024-01-08");
  });

  it("anchors months to their first day", () => {
    expect(standardizeDate("2024-02-29", "monthly")).toBe("2024-02-01");
  });

  it("handles leap years and rejects impossible dates", () => {
    expect(parseIsoDate("2024-02-29")).not.toBeNull();
    expect(parseIsoDate("2023-02-29")).toBeNull();
  });

  it("advances across month and year boundaries", () => {
    expect(nextPeriod("2024-01-31", "daily")).toBe("2024-02-01");
    expect(nextPeriod("2024-12-30", "weekly")).toBe("2025-01-06");
    expect(nextPeriod("2024-12-01", "monthly")).toBe("2025-01-01");
  });

  it("does not shift dates across daylight-saving boundaries", () => {
    expect(nextPeriod("2024-03-10", "daily")).toBe("2024-03-11");
    expect(nextPeriod("2024-11-03", "daily")).toBe("2024-11-04");
  });
});

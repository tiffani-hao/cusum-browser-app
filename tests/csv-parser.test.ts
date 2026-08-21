import { describe, expect, it } from "vitest";
import { parseCsvText } from "../src/import";

describe("CSV parsing", () => {
  it("parses a valid CSV and preserves columns", () => {
    const result = parseCsvText("area,date,count\nA,2024-01-01,2");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.table.columns).toEqual(["area", "date", "count"]);
      expect(result.table.rows[0]).toEqual({ area: "A", date: "2024-01-01", count: "2" });
    }
  });

  it("supports quoted commas and quoted newlines", () => {
    const result = parseCsvText('area,date,count\n"North, District",2024-01-01,2\n"South\nDistrict",2024-01-02,3');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.table.rows[0]?.area).toBe("North, District");
      expect(result.table.rows[1]?.area).toBe("South\nDistrict");
    }
  });

  it("removes a UTF-8 BOM from the first header", () => {
    const result = parseCsvText("\ufeffarea,date,count\nA,2024-01-01,1");
    expect(result.success).toBe(true);
    if (result.success) expect(result.table.columns[0]).toBe("area");
  });

  it("ignores completely blank trailing lines", () => {
    const result = parseCsvText("area,date,count\nA,2024-01-01,1\n\n");
    expect(result.success).toBe(true);
    if (result.success) expect(result.table.rows).toHaveLength(1);
  });

  it.each([
    ["", "empty_file"],
    ["\nA,2024-01-01,1", "missing_header"],
    ["area,date,area\nA,2024-01-01,A", "duplicate_header"],
    ["area,,count\nA,2024-01-01,1", "empty_header"],
    ['area,date,count\n"A,2024-01-01,1', "MissingQuotes"],
  ])("reports invalid CSV input", (content, code) => {
    const result = parseCsvText(content);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((issue) => issue.code)).toContain(code);
  });

  it("preserves a partially populated row for analytical validation", () => {
    const result = parseCsvText("area,date,count\nA,2024-01-01");
    expect(result.success).toBe(true);
    if (result.success) expect(result.table.rows[0]).toEqual({
      area: "A",
      date: "2024-01-01",
      count: null,
    });
  });
});

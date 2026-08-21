import { describe, expect, it } from "vitest";
import { parseExcelArrayBuffer } from "../src/import";
import { createXlsxBuffer } from "./helpers/xlsx";

describe("XLSX parsing", () => {
  it("parses a valid workbook", async () => {
    const result = await parseExcelArrayBuffer(createXlsxBuffer([
      { name: "Data", rows: [["area", "date", "count"], ["A", "2024-01-01", 2]] },
    ]));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.table.worksheet_name).toBe("Data");
      expect(result.table.rows[0]?.count).toBe(2);
    }
  });

  it("selects the first worksheet", async () => {
    const result = await parseExcelArrayBuffer(createXlsxBuffer([
      { name: "First", rows: [["area", "date", "count"], ["A", "2024-01-01", 1]] },
      { name: "Second", rows: [["area", "date", "count"], ["B", "2024-01-01", 2]] },
    ]));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.table.worksheet_name).toBe("First");
      expect(result.table.rows[0]?.area).toBe("A");
    }
  });

  it.each([
    [[], "no_worksheets"],
    [[{ name: "Data", rows: [["area", "date", "count"]] }], "no_data_rows"],
    [[{ name: "Data", rows: [["area", "date", "area"], ["A", "2024-01-01", "A"]] }], "duplicate_header"],
    [[{ name: "Data", rows: [["area", null, "count"], ["A", "2024-01-01", 1]] }], "empty_header"],
  ] as const)("reports workbook structure errors", async (sheets, code) => {
    const result = await parseExcelArrayBuffer(createXlsxBuffer([...sheets]));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((issue) => issue.code)).toContain(code);
  });

  it("ignores fully blank trailing rows", async () => {
    const result = await parseExcelArrayBuffer(createXlsxBuffer([
      { name: "Data", rows: [["area", "date", "count"], ["A", "2024-01-01", 1], [null, null, null]] },
    ]));
    expect(result.success).toBe(true);
    if (result.success) expect(result.table.rows).toHaveLength(1);
  });

  it("rejects a malformed workbook", async () => {
    const result = await parseExcelArrayBuffer(new TextEncoder().encode("not xlsx").buffer);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.code).toBe("malformed_workbook");
  });

  it("uses a stored formula result without evaluating the formula", async () => {
    const result = await parseExcelArrayBuffer(createXlsxBuffer([
      { name: "Data", rows: [["area", "date", "count"], ["A", "2024-01-01", { formula: "1+1", value: 2 }]] },
    ]));
    expect(result.success).toBe(true);
    if (result.success) expect(result.table.rows[0]?.count).toBe(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  parseCsvText,
  parseExcelArrayBuffer,
  validateImportedTable,
} from "../src/import";
import { createXlsxBuffer } from "./helpers/xlsx";

describe("imported date and stratification validation", () => {
  it("converts Excel serial dates from CSV only in the date field", () => {
    const parsed = parseCsvText("area,date,count\nArea A,45292,45292");
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const validation = validateImportedTable(parsed.table.columns, parsed.table.rows);
    expect(validation.valid).toBe(true);
    expect(validation.valid_records[0]).toEqual({
      area: "Area A",
      date: "2024-01-01",
      count: 45292,
    });
  });

  it("converts Excel serial dates from XLSX through the shared validation path", async () => {
    const parsed = await parseExcelArrayBuffer(createXlsxBuffer([
      { name: "Data", rows: [["area", "date", "count"], ["Area A", 45292, 5]] },
    ]));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const validation = validateImportedTable(parsed.table.columns, parsed.table.rows);
    expect(validation.valid).toBe(true);
    expect(validation.valid_records[0]?.date).toBe("2024-01-01");
  });

  it.each([0, 60, 45_292.5, 3_000_000])(
    "rejects invalid Excel serial date %s with a clear row-level issue",
    (serial) => {
      const validation = validateImportedTable(
        ["area", "date", "count"],
        [{ area: "Area A", date: serial, count: 1 }],
      );
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(expect.objectContaining({
        code: "invalid_excel_serial_date",
        field: "date",
        record_index: 2,
      }));
      expect(validation.issues[0]?.message).toContain("Excel 1900-system serial date");
    },
  );

  it("keeps a normal three-column table valid and non-stratified", () => {
    const validation = validateImportedTable(
      ["area", "date", "count"],
      [{ area: "Area A", date: "2024-01-01", count: 1 }],
    );
    expect(validation.valid).toBe(true);
    expect(validation.has_risk_group).toBe(false);
  });

  it("recognizes the canonical strata column and normalizes it for analysis", () => {
    const validation = validateImportedTable(
      ["area", "date", "count", "strata"],
      [{ area: "Area A", date: "2024-01-01", count: 1, strata: "Stratum A" }],
    );
    expect(validation.valid).toBe(true);
    expect(validation.has_risk_group).toBe(true);
    expect(validation.valid_records[0]?.risk_group).toBe("Stratum A");
  });

  it("accepts the legacy compatibility header without exposing it in feedback", () => {
    const validation = validateImportedTable(
      ["area", "date", "count", "risk_group"],
      [{ area: "Area A", date: "2024-01-01", count: 1, risk_group: "Stratum A" }],
    );
    expect(validation.valid).toBe(true);
    expect(validation.has_risk_group).toBe(true);
    expect(validation.valid_records[0]?.risk_group).toBe("Stratum A");
  });

  it("rejects an empty stratum and does not expose unusable stratification", () => {
    const validation = validateImportedTable(
      ["area", "date", "count", "strata"],
      [{ area: "Area A", date: "2024-01-01", count: 1, strata: " " }],
    );
    expect(validation.valid).toBe(false);
    expect(validation.has_risk_group).toBe(false);
    expect(validation.issues).toContainEqual(expect.objectContaining({
      code: "invalid_stratification_value",
      field: "strata",
    }));
  });

  it("rejects two stratification columns using only canonical terminology", () => {
    const validation = validateImportedTable(
      ["area", "date", "count", "strata", "risk_group"],
      [{ area: "Area A", date: "2024-01-01", count: 1, strata: "A", risk_group: "A" }],
    );
    expect(validation.valid).toBe(false);
    expect(validation.issues).toContainEqual(expect.objectContaining({
      code: "duplicate_stratification_column",
      field: "strata",
      message: "Provide only one stratification variable column.",
    }));
    expect(validation.issues.map((issue) => `${issue.field} ${issue.message}`).join(" "))
      .not.toContain("risk_group");
  });

  it("warns about an unrecognized fourth column without enabling stratification", () => {
    const validation = validateImportedTable(
      ["area", "date", "count", "category"],
      [{ area: "Area A", date: "2024-01-01", count: 1, category: "A" }],
    );
    expect(validation.valid).toBe(true);
    expect(validation.has_risk_group).toBe(false);
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      code: "unrecognized_stratification_column",
      severity: "warning",
    }));
  });
});

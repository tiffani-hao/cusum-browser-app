import { describe, expect, it } from "vitest";
import { analyzeCusum, DEFAULT_ANALYSIS_OPTIONS } from "../src/core";
import {
  parseCsvText,
  parseExcelArrayBuffer,
  validateImportedTable,
} from "../src/import";
import { createXlsxBuffer } from "./helpers/xlsx";

describe("imported date and stratification validation", () => {
  it.each([
    ["2026-06-01", "2026-06-01"],
    ["06/01/2026", "2026-06-01"],
    ["6/1/2026", "2026-06-01"],
    ["06/01/26", "2026-06-01"],
    ["Jun 1 2026", "2026-06-01"],
    ["June 1, 2026", "2026-06-01"],
    ["1-Jun-2026", "2026-06-01"],
    ["1 Jun 2026", "2026-06-01"],
    ["2026/06/01", "2026-06-01"],
    ["2026-06-01 00:00:00", "2026-06-01"],
    ["2026-06-01T23:59:59Z", "2026-06-01"],
  ])("normalizes imported date %s to %s", (input, expected) => {
    const validation = validateImportedTable(
      ["area", "date", "count"],
      [{ area: "Area A", date: input, count: 1 }],
    );
    expect(validation.valid).toBe(true);
    expect(validation.valid_records[0]?.date).toBe(expected);
  });

  it.each(["02/30/2026", "2026-13-01", "31/31/2026", "abc", "not-a-date"])(
    "rejects invalid or unrecognized date %s without calendar rollover",
    (input) => {
      const validation = validateImportedTable(
        ["area", "date", "count"],
        [{ area: "Area A", date: input, count: 1 }],
      );
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(expect.objectContaining({
        code: "invalid_date",
        field: "date",
        record_index: 2,
      }));
      expect(validation.issues.find((issue) => issue.code === "invalid_date")?.message)
        .toContain("invalid or unrecognized date value");
    },
  );

  it("infers month-first slash dates from unambiguous column evidence", () => {
    const validation = validateImportedTable(
      ["area", "date", "count"],
      [
        { area: "Area A", date: "01/05/2026", count: 1 },
        { area: "Area A", date: "02/13/2026", count: 2 },
        { area: "Area A", date: "03/14/2026", count: 3 },
      ],
    );
    expect(validation.valid).toBe(true);
    expect(validation.valid_records.map((record) => record.date)).toEqual([
      "2026-01-05",
      "2026-02-13",
      "2026-03-14",
    ]);
    expect(validation.warnings).toEqual([]);
  });

  it("infers day-first slash dates from unambiguous column evidence", () => {
    const validation = validateImportedTable(
      ["area", "date", "count"],
      [
        { area: "Area A", date: "05/01/2026", count: 1 },
        { area: "Area A", date: "13/02/2026", count: 2 },
        { area: "Area A", date: "14/03/2026", count: 3 },
      ],
    );
    expect(validation.valid).toBe(true);
    expect(validation.valid_records.map((record) => record.date)).toEqual([
      "2026-01-05",
      "2026-02-13",
      "2026-03-14",
    ]);
    expect(validation.warnings).toEqual([]);
  });

  it("defaults an entirely ambiguous slash-date column to month-first with a warning", () => {
    const validation = validateImportedTable(
      ["area", "date", "count"],
      [
        { area: "Area A", date: "01/02/2026", count: 1 },
        { area: "Area A", date: "03/04/2026", count: 2 },
        { area: "Area A", date: "05/06/2026", count: 3 },
      ],
    );
    expect(validation.valid).toBe(true);
    expect(validation.valid_records.map((record) => record.date)).toEqual([
      "2026-01-02",
      "2026-03-04",
      "2026-05-06",
    ]);
    expect(validation.warnings).toContainEqual(expect.objectContaining({
      code: "ambiguous_numeric_dates",
      severity: "warning",
      field: "date",
      message: "Some dates are ambiguous between MM/DD/YYYY and DD/MM/YYYY. They were interpreted as MM/DD/YYYY.",
    }));
  });

  it("rejects conflicting month-first and day-first column evidence", () => {
    const validation = validateImportedTable(
      ["area", "date", "count"],
      [
        { area: "Area A", date: "13/02/2026", count: 1 },
        { area: "Area A", date: "02/13/2026", count: 2 },
      ],
    );
    expect(validation.valid).toBe(false);
    expect(validation.valid_records).toEqual([]);
    expect(validation.invalid_record_count).toBe(2);
    expect(validation.issues).toContainEqual(expect.objectContaining({
      code: "inconsistent_date_formats",
      field: "date",
    }));
    expect(validation.issues[0]?.message).toContain("Please use one consistent date format");
  });

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

  it("produces the same normalized input and analysis for Excel dates and Excel-exported CSV dates", async () => {
    const xlsx = await parseExcelArrayBuffer(createXlsxBuffer([
      {
        name: "Data",
        rows: [
          ["area", "date", "count"],
          ["Area A", 46_174, 2],
          ["Area A", 46_204, 4],
          ["Area A", 46_235, 3],
        ],
      },
    ]));
    const csv = parseCsvText([
      "area,date,count",
      "Area A,6/1/2026,2",
      "Area A,7/1/2026,4",
      "Area A,8/1/2026,3",
    ].join("\n"));
    expect(xlsx.success).toBe(true);
    expect(csv.success).toBe(true);
    if (!xlsx.success || !csv.success) return;

    const xlsxValidation = validateImportedTable(xlsx.table.columns, xlsx.table.rows);
    const csvValidation = validateImportedTable(csv.table.columns, csv.table.rows);
    expect(xlsxValidation.valid).toBe(true);
    expect(csvValidation.valid).toBe(true);
    expect(csvValidation.valid_records.map((record) => record.date)).toEqual([
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
    ]);
    expect(csvValidation.valid_records).toEqual(xlsxValidation.valid_records);
    expect(analyzeCusum(csvValidation.valid_records, DEFAULT_ANALYSIS_OPTIONS))
      .toEqual(analyzeCusum(xlsxValidation.valid_records, DEFAULT_ANALYSIS_OPTIONS));
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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeCusum } from "../src/core";
import { DEFAULT_DISEASE_PRESET } from "../src/config";
import { parseCsvText, validateImportedTable } from "../src/import";

interface SampleRecord {
  area: string;
  date: string;
  count: number;
  riskGroup: string;
}

describe("committed synthetic risk-group sample", () => {
  const text = readFileSync(
    new URL("../sample-data/risk-group-example.csv", import.meta.url),
    "utf8",
  );
  const lines = text.trimEnd().split(/\r?\n/);
  const records: SampleRecord[] = lines.slice(1).map((line) => {
    const [area, date, count, riskGroup] = line.split(",");
    return {
      area: area ?? "",
      date: date ?? "",
      count: Number(count),
      riskGroup: riskGroup ?? "",
    };
  });

  it("has the exact schema, dimensions, and monthly date range", () => {
    expect(lines[0]).toBe("area,date,count,risk_group");
    expect(records).toHaveLength(1_008);
    expect([...new Set(records.map((record) => record.area))]).toEqual([
      "Area A",
      "Area B",
      "Area C",
      "Area D",
    ]);
    expect([...new Set(records.map((record) => record.riskGroup))]).toEqual([
      "Group 1",
      "Group 2",
      "Group 3",
    ]);
    expect(records[0]?.date).toBe("2019-01-01");
    expect(records.at(-1)?.date).toBe("2025-12-01");
    expect(records.every((record) => /^\d{4}-\d{2}-01$/.test(record.date))).toBe(true);
  });

  it("contains 84 unique nonnegative integer observations per series", () => {
    const combinations = new Map<string, Set<string>>();
    for (const record of records) {
      expect(record.area).not.toBe("");
      expect(record.date).not.toBe("");
      expect(record.riskGroup).not.toBe("");
      expect(Number.isFinite(record.count)).toBe(true);
      expect(Number.isInteger(record.count)).toBe(true);
      expect(record.count).toBeGreaterThanOrEqual(0);
      const series = `${record.area}\u0000${record.riskGroup}`;
      const dates = combinations.get(series) ?? new Set<string>();
      expect(dates.has(record.date)).toBe(false);
      dates.add(record.date);
      combinations.set(series, dates);
    }
    expect(combinations).toHaveLength(12);
    for (const dates of combinations.values()) {
      expect(dates).toHaveLength(84);
      expect([...dates][0]).toBe("2019-01-01");
      expect([...dates].at(-1)).toBe("2025-12-01");
    }
  });

  it("is sorted deterministically by area, risk group, and date", () => {
    const keys = records.map((record) =>
      `${record.area}\u0000${record.riskGroup}\u0000${record.date}`
    );
    expect(keys).toEqual([...keys].sort((left, right) => left.localeCompare(right)));
  });

  it("demonstrates grouped analysis with alerts in only some records", () => {
    const parsed = parseCsvText(text);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    const validation = validateImportedTable(parsed.table.columns, parsed.table.rows);
    expect(validation.valid).toBe(true);
    const result = analyzeCusum(validation.valid_records, {
      ...DEFAULT_DISEASE_PRESET.options,
      group_by_risk_group: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.summary.independent_series_count).toBe(12);
    expect(result.summary.alert_count).toBeGreaterThan(0);
    expect(result.summary.alert_count).toBeLessThan(result.summary.processed_row_count);
    const alertSeries = new Set(
      result.records
        .filter((record) => record.is_alert)
        .map((record) => `${record.area}\u0000${record.risk_group ?? ""}`),
    );
    expect(alertSeries.size).toBeGreaterThan(0);
    expect(alertSeries.size).toBeLessThan(12);
  });
});

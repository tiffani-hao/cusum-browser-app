import { describe, expect, it } from "vitest";
import { analyzeCusum } from "../src/core";
import type { AnalysisOptions, ValidatedInputRecord } from "../src/core";
import { parseCsvText, validateImportedTable } from "../src/import";
import {
  buildCusumChartData,
  createDefaultDisplayFilters,
  filterProcessedRecords,
  paginateRecords,
  serializeProcessedCsv,
} from "../src/results";

const OPTIONS: AnalysisOptions = {
  analysis_interval: "daily",
  smoothing_window: 3,
  baseline_window: 36,
  k: 0.1,
  threshold: 3,
  group_by_risk_group: false,
};

const SIZES = [1_000, 10_000, 50_000, 100_000] as const;

describe("large synthetic-data performance observations", () => {
  it.each(SIZES)("processes %i synthetic rows without truncating or over-rendering", (size) => {
    const generated = generateSyntheticRows(size);
    const timings: Record<string, number> = {};

    let started = performance.now();
    const parsed = parseCsvText(generated.csv);
    timings.parsing_ms = performance.now() - started;
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    started = performance.now();
    const validation = validateImportedTable(parsed.table.columns, parsed.table.rows);
    timings.validation_ms = performance.now() - started;
    expect(validation.valid).toBe(true);

    started = performance.now();
    const analysis = analyzeCusum(validation.valid_records, OPTIONS);
    timings.analysis_ms = performance.now() - started;
    expect(analysis.success).toBe(true);
    if (!analysis.success) return;
    expect(analysis.summary.input_row_count).toBe(size);
    expect(analysis.records).toHaveLength(size);

    started = performance.now();
    const filtered = filterProcessedRecords(
      analysis.records,
      createDefaultDisplayFilters(analysis.records),
    );
    timings.filtering_ms = performance.now() - started;
    expect(filtered).toHaveLength(size);

    started = performance.now();
    const chart = buildCusumChartData(analysis.records, OPTIONS.threshold);
    timings.chart_data_ms = performance.now() - started;
    expect(chart.datasets.length).toBe(generated.series_count + 1);

    started = performance.now();
    const page = paginateRecords(analysis.records, 1, 100);
    timings.pagination_ms = performance.now() - started;
    expect(page.records.length).toBeLessThanOrEqual(100);

    started = performance.now();
    const csv = serializeProcessedCsv(analysis.records);
    timings.csv_serialization_ms = performance.now() - started;
    expect(csv.split("\r\n")).toHaveLength(size + 2);

    // Machine-specific observations are printed for documentation, never asserted as universal limits.
    console.info(`PERFORMANCE ${size}`, JSON.stringify(roundTimings(timings)));
  }, 60_000);
});

function generateSyntheticRows(size: number): {
  csv: string;
  records: ValidatedInputRecord[];
  series_count: number;
} {
  const periodsPerSeries = 1_000;
  const seriesCount = Math.ceil(size / periodsPerSeries);
  const records: ValidatedInputRecord[] = [];
  const lines = ["area,date,count"];
  for (let index = 0; index < size; index += 1) {
    const series = Math.floor(index / periodsPerSeries);
    const period = index % periodsPerSeries;
    const date = new Date(Date.UTC(2020, 0, 1 + period)).toISOString().slice(0, 10);
    const count = index % 17;
    const area = `Area ${String(series + 1).padStart(3, "0")}`;
    records.push({ area, date, count });
    lines.push(`${area},${date},${count}`);
  }
  return { csv: lines.join("\n"), records, series_count: seriesCount };
}

function roundTimings(timings: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, Math.round(value * 10) / 10]));
}


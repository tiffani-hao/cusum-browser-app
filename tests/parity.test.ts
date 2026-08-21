import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeCusum } from "../src/core";
import type { GoldenFixture, ProcessedCusumRecord } from "../src/core";

const FIXTURE_DIRECTORY = fileURLToPath(new URL("../test-fixtures/expected/", import.meta.url));
const fixtureFiles = readdirSync(FIXTURE_DIRECTORY)
  .filter((filename) => filename.endsWith(".json"))
  .sort();

function loadFixture(filename: string): GoldenFixture {
  return JSON.parse(readFileSync(`${FIXTURE_DIRECTORY}/${filename}`, "utf8")) as GoldenFixture;
}

function compareField(
  filename: string,
  index: number,
  field: keyof ProcessedCusumRecord,
  expected: ProcessedCusumRecord[keyof ProcessedCusumRecord],
  actual: ProcessedCusumRecord[keyof ProcessedCusumRecord],
): void {
  if (typeof expected === "number" && typeof actual === "number") {
    const difference = Math.abs(expected - actual);
    expect(
      difference,
      `${filename}, record ${index}, ${field}: expected ${expected}, actual ${actual}, absolute difference ${difference}`,
    ).toBeLessThanOrEqual(1e-10);
  } else {
    expect(actual, `${filename}, record ${index}, ${field}: expected ${String(expected)}, actual ${String(actual)}`).toBe(expected);
  }
}

describe("golden fixture parity", () => {
  it("discovers all 26 fixtures", () => {
    expect(fixtureFiles).toHaveLength(26);
  });

  for (const filename of fixtureFiles) {
    it(`matches ${filename}`, () => {
      const fixture = loadFixture(filename);
      const result = analyzeCusum(fixture.raw_records, fixture.analysis_options);
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.records).toHaveLength(fixture.expected_records.length);
      fixture.expected_records.forEach((expectedRecord, index) => {
        const actualRecord = result.records[index];
        expect(actualRecord, `${filename}, missing record ${index}`).toBeDefined();
        if (actualRecord === undefined) return;
        expect(Object.keys(actualRecord)).toEqual(Object.keys(expectedRecord));
        for (const field of Object.keys(expectedRecord) as (keyof ProcessedCusumRecord)[]) {
          compareField(filename, index, field, expectedRecord[field], actualRecord[field]);
        }
      });
      expect(result.summary.areas_included).toBe(fixture.summary.areas_included);
      expect(result.summary.risk_groups_included).toEqual(fixture.summary.risk_groups_included);
      expect(result.summary.alerts_detected).toBe(fixture.summary.alerts_detected);
      expect(result.summary.input_row_count).toBe(fixture.input_row_count);
      expect(result.summary.processed_row_count).toBe(fixture.processed_row_count);
    });
  }
});

import { describe, expect, it } from "vitest";
import {
  importLocalFile,
  MAX_FILE_SIZE_BYTES,
  MAX_PARSED_ROWS,
} from "../src/import";
import { createXlsxBuffer } from "./helpers/xlsx";

function csvFile(content: string, name = "data.csv", type = "text/csv"): File {
  return new File([content], name, { type });
}

describe("unified local file import", () => {
  it("imports valid CSV and XLSX files", async () => {
    const csv = await importLocalFile(csvFile("area,date,count\nA,2024-01-01,1"));
    expect(csv.success).toBe(true);
    const xlsx = await importLocalFile(new File([
      createXlsxBuffer([{ name: "Data", rows: [["area", "date", "count"], ["A", "2024-01-01", 1]] }]),
    ], "data.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    expect(xlsx.success).toBe(true);
  });

  it.each([
    [new File(["data"], "data.txt"), "unsupported_extension"],
    [new File([], "data.csv"), "zero_byte_file"],
    [new File([new Uint8Array(MAX_FILE_SIZE_BYTES + 1)], "data.csv"), "file_too_large"],
    [new File([createXlsxBuffer([{ name: "Data", rows: [["area"]] }])], "data.csv"), "content_mismatch"],
    [new File(["not a workbook"], "data.xlsx"), "content_mismatch"],
  ])("rejects unsafe or unsupported files", async (file, code) => {
    const result = await importLocalFile(file);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.map((issue) => issue.code)).toContain(code);
  });

  it("enforces the parsed row limit", async () => {
    const content = `area,date,count\n${Array.from(
      { length: MAX_PARSED_ROWS + 1 },
      (_, index) => `A,2024-01-01,${index}`,
    ).join("\n")}`;
    const result = await importLocalFile(csvFile(content));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]?.code).toBe("too_many_rows");
  });

  it("returns parser failures without throwing", async () => {
    const result = await importLocalFile(csvFile('area,date,count\n"broken'));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.some((issue) => issue.scope === "parser" || issue.scope === "row")).toBe(true);
  });
});

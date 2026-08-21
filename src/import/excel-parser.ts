import readXlsxFile from "read-excel-file/universal";
import { buildParsedTable } from "./table-validation";
import type { FileParsingIssue } from "./types";
import type { TableParserResult } from "./csv-parser";

export async function parseExcelArrayBuffer(content: ArrayBuffer): Promise<TableParserResult> {
  if (content.byteLength === 0) {
    return {
      success: false,
      issues: [{
        code: "empty_file",
        message: "The workbook is empty.",
        scope: "file",
        severity: "error",
      }],
    };
  }
  try {
    const sheets = await readXlsxFile(content);
    const firstSheet = sheets[0];
    if (firstSheet === undefined) {
      return {
        success: false,
        issues: [{
          code: "no_worksheets",
          message: "The workbook does not contain a worksheet.",
          scope: "file",
          severity: "error",
        }],
      };
    }
    const built = buildParsedTable(firstSheet.data, firstSheet.sheet);
    if (built.table === undefined || built.issues.some((entry) => entry.severity === "error")) {
      return { success: false, issues: built.issues };
    }
    return { success: true, table: built.table, issues: built.issues };
  } catch {
    const issue: FileParsingIssue = {
      code: "malformed_workbook",
      message: "The workbook could not be read as a supported XLSX file.",
      scope: "parser",
      severity: "error",
    };
    return { success: false, issues: [issue] };
  }
}

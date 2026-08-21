import Papa from "papaparse";
import { buildParsedTable } from "./table-validation";
import type { FileParsingIssue, ParsedTable } from "./types";

export type TableParserResult =
  | { success: true; table: ParsedTable; issues: FileParsingIssue[] }
  | { success: false; issues: FileParsingIssue[] };

export function parseCsvText(content: string): TableParserResult {
  if (content.length === 0) {
    return {
      success: false,
      issues: [{
        code: "empty_file",
        message: "The CSV file is empty.",
        scope: "file",
        severity: "error",
      }],
    };
  }
  const normalizedContent = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
  const parsed = Papa.parse<string[]>(normalizedContent, {
    delimiter: ",",
    dynamicTyping: false,
    skipEmptyLines: false,
  });
  const parserIssues: FileParsingIssue[] = parsed.errors.map((error) => ({
    code: error.code,
    message: error.message,
    scope: error.row === undefined ? "parser" : "row",
    severity: "error",
    ...(error.row === undefined ? {} : { row_number: error.row + 1 }),
  }));
  const built = buildParsedTable(parsed.data);
  const issues = [...parserIssues, ...built.issues];
  if (built.table === undefined || issues.some((entry) => entry.severity === "error")) {
    return { success: false, issues };
  }
  return { success: true, table: built.table, issues };
}

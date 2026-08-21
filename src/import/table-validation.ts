import type {
  ColumnName,
  FileParsingIssue,
  ParsedCellValue,
  ParsedRow,
  ParsedTable,
} from "./types";

function cellToHeader(value: unknown): string {
  if (value === null || value === undefined) return "";
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
}

export function isBlankCell(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function trimTrailingBlankRows(rows: unknown[][]): unknown[][] {
  const trimmed = [...rows];
  while (trimmed.length > 0 && (trimmed[trimmed.length - 1] ?? []).every(isBlankCell)) trimmed.pop();
  return trimmed;
}

export function buildParsedTable(
  sourceRows: unknown[][],
  worksheetName?: string,
): { table?: ParsedTable; issues: FileParsingIssue[] } {
  const rows = trimTrailingBlankRows(sourceRows);
  const issues: FileParsingIssue[] = [];
  const headerRow = rows[0];
  if (headerRow === undefined || headerRow.every(isBlankCell)) {
    return {
      issues: [{
        code: "missing_header",
        message: "The file must contain a nonempty header row.",
        scope: "header",
        severity: "error",
      }],
    };
  }
  const columns: ColumnName[] = headerRow.map(cellToHeader);
  columns.forEach((column, index) => {
    if (column.trim() === "") {
      issues.push({
        code: "empty_header",
        message: `Column ${index + 1} has an empty header.`,
        scope: "header",
        severity: "error",
        field: `column_${index + 1}`,
      });
    }
  });
  const seen = new Set<string>();
  for (const column of columns) {
    if (seen.has(column)) {
      issues.push({
        code: "duplicate_header",
        message: `The header "${column}" appears more than once.`,
        scope: "header",
        severity: "error",
        field: column,
      });
    }
    seen.add(column);
  }
  const dataRows = rows.slice(1);
  if (dataRows.length === 0) {
    issues.push({
      code: "no_data_rows",
      message: "The file contains a header but no data rows.",
      scope: "file",
      severity: "error",
    });
  }
  dataRows.forEach((row, index) => {
    if (row.length > columns.length) {
      issues.push({
        code: "too_many_fields",
        message: `Row ${index + 2} contains more fields than the header.`,
        scope: "row",
        severity: "error",
        row_number: index + 2,
      });
    }
  });
  if (issues.some((entry) => entry.severity === "error")) return { issues };

  const parsedRows: ParsedRow[] = dataRows.map((row) => {
    const record: ParsedRow = {};
    columns.forEach((column, index) => {
      const value = row[index];
      record[column] = normalizeCell(value);
    });
    return record;
  });
  return {
    table: {
      columns,
      rows: parsedRows,
      ...(worksheetName === undefined ? {} : { worksheet_name: worksheetName }),
    },
    issues,
  };
}

function normalizeCell(value: unknown): ParsedCellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

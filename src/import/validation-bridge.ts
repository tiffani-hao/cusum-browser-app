import { validateRecords } from "../core";
import type { RawTabularRecord, ValidatedInputRecord, ValidationIssue } from "../core";
import type {
  FileParsingIssue,
  InputValidationSummary,
  ParsedRow,
} from "./types";
import { inspectDateColumn, normalizeImportedDate } from "./date-normalization";

const REQUIRED_COLUMNS = ["area", "date", "count"] as const;

function normalizeCount(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return value;
  return Number(trimmed);
}

function isUsableStratum(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function validateImportedTable(columns: string[], rows: ParsedRow[]): InputValidationSummary {
  const requiredColumnsFound = REQUIRED_COLUMNS.filter((column) => columns.includes(column));
  const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
  const hasStrataColumn = columns.includes("strata");
  const hasLegacyStrataColumn = columns.includes("risk_group");
  const hasConflictingStrataColumns = hasStrataColumn && hasLegacyStrataColumn;
  const stratificationColumn = hasConflictingStrataColumns
    ? undefined
    : hasStrataColumn ? "strata" : hasLegacyStrataColumn ? "risk_group" : undefined;
  const invalidStrataRows = stratificationColumn === undefined
    ? []
    : rows.flatMap((row, index) => isUsableStratum(row[stratificationColumn]) ? [] : [index + 2]);
  const hasRiskGroup = stratificationColumn !== undefined && invalidStrataRows.length === 0;
  const warnings: FileParsingIssue[] = [];
  const dateColumnFormat = inspectDateColumn(rows.map((row) => row.date));
  const issues: ValidationIssue[] = [
    ...missingRequiredColumns.map((column) => ({
      code: "missing_required_column",
      message: `Required column "${column}" was not found.`,
      field: column,
    })),
    ...(hasConflictingStrataColumns ? [{
      code: "duplicate_stratification_column",
      message: "Provide only one stratification variable column.",
      field: "strata",
    }] : []),
    ...(dateColumnFormat.conflict_rows.length === 0 ? [] : [{
      code: "inconsistent_date_formats",
      message: `The date column contains inconsistent date formats. Some values appear to use DD/MM/YYYY while others appear to use MM/DD/YYYY. Please use one consistent date format. (example rows ${dateColumnFormat.conflict_rows.join(" and ")})`,
      field: "date",
    }]),
  ];
  const validRecords: ValidatedInputRecord[] = [];
  let invalidRecordCount = 0;

  if (stratificationColumn === undefined && !hasConflictingStrataColumns && columns.length === 4) {
    warnings.push({
      code: "unrecognized_stratification_column",
      message: "A fourth column was found, but it is not a recognized stratification variable and will not be used.",
      scope: "header",
      severity: "warning",
      ...(columns[3] === undefined ? {} : { field: columns[3] }),
    });
  }

  if (dateColumnFormat.ambiguous) {
    warnings.push({
      code: "ambiguous_numeric_dates",
      message: "Some dates are ambiguous between MM/DD/YYYY and DD/MM/YYYY. They were interpreted as MM/DD/YYYY.",
      scope: "row",
      severity: "warning",
      field: "date",
    });
  }

  if (missingRequiredColumns.length === 0) {
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const normalizedDate = normalizeImportedDate(row.date, dateColumnFormat.order);
      const rowIssues: ValidationIssue[] = [];
      if (!normalizedDate.valid && normalizedDate.code === "invalid_excel_serial_date") {
        rowIssues.push({
          code: "invalid_excel_serial_date",
          message: `Date contains an invalid Excel 1900-system serial date. (row ${rowNumber})`,
          field: "date",
          record_index: rowNumber,
        });
      } else if (!normalizedDate.valid) {
        rowIssues.push({
          code: "invalid_date",
          message: `Date contains an invalid or unrecognized date value. Use a recognizable date format such as 2026-06-01 or 06/01/2026. (row ${rowNumber})`,
          field: "date",
          record_index: rowNumber,
        });
      }
      const stratum = stratificationColumn === undefined ? undefined : row[stratificationColumn];
      if (stratificationColumn !== undefined && !isUsableStratum(stratum)) {
        rowIssues.push({
          code: "invalid_stratification_value",
          message: `The stratification variable must contain a nonempty stratum value. (row ${rowNumber})`,
          field: "strata",
          record_index: rowNumber,
        });
      }
      const candidate: RawTabularRecord = {
        area: row.area,
        date: normalizedDate.valid ? normalizedDate.value : "2000-01-01",
        count: normalizeCount(row.count),
        ...(stratificationColumn === undefined ? {} : { risk_group: stratum }),
      };
      const result = validateRecords([candidate]);
      issues.push(...rowIssues);
      if (result.valid && rowIssues.length === 0 && dateColumnFormat.conflict_rows.length === 0) {
        validRecords.push(result.value[0] as ValidatedInputRecord);
      } else {
        invalidRecordCount += 1;
        if (!result.valid) {
          issues.push(...result.issues.map((entry) => ({
            ...entry,
            record_index: rowNumber,
            message: `${entry.message} (row ${rowNumber})`,
          })));
        }
      }
    });
  } else {
    invalidRecordCount = rows.length;
  }

  return {
    valid: issues.length === 0,
    required_columns_found: [...requiredColumnsFound],
    missing_required_columns: [...missingRequiredColumns],
    has_risk_group: hasRiskGroup,
    valid_record_count: validRecords.length,
    invalid_record_count: invalidRecordCount,
    issues,
    warnings,
    valid_records: validRecords,
  };
}

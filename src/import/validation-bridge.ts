import { validateRecords } from "../core";
import type { RawTabularRecord, ValidatedInputRecord, ValidationIssue } from "../core";
import type {
  FileParsingIssue,
  InputValidationSummary,
  ParsedRow,
} from "./types";
import { excelSerialDateToIso, numericDateSerial } from "./excel-serial-date";

const REQUIRED_COLUMNS = ["area", "date", "count"] as const;

function normalizeCount(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return value;
  return Number(trimmed);
}

function normalizeImportedDate(value: unknown): { value: unknown; invalidSerial: boolean } {
  const serial = numericDateSerial(value);
  if (serial === undefined) return { value, invalidSerial: false };
  const converted = excelSerialDateToIso(serial);
  return converted === null
    ? { value: "2000-01-01", invalidSerial: true }
    : { value: converted, invalidSerial: false };
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

  if (missingRequiredColumns.length === 0) {
    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const normalizedDate = normalizeImportedDate(row.date);
      const rowIssues: ValidationIssue[] = [];
      if (normalizedDate.invalidSerial) {
        rowIssues.push({
          code: "invalid_excel_serial_date",
          message: `Date must be a valid Excel 1900-system serial date or an ISO date in YYYY-MM-DD format. (row ${rowNumber})`,
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
        date: normalizedDate.value,
        count: normalizeCount(row.count),
        ...(stratificationColumn === undefined ? {} : { risk_group: stratum }),
      };
      const result = validateRecords([candidate]);
      issues.push(...rowIssues);
      if (result.valid && rowIssues.length === 0) {
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

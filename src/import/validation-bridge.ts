import { validateRecords } from "../core";
import type { RawTabularRecord, ValidatedInputRecord, ValidationIssue } from "../core";
import type {
  FileParsingIssue,
  InputValidationSummary,
  ParsedRow,
} from "./types";

const REQUIRED_COLUMNS = ["area", "date", "count"] as const;

function normalizeCount(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return value;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return value;
  return Number(trimmed);
}

export function validateImportedTable(columns: string[], rows: ParsedRow[]): InputValidationSummary {
  const requiredColumnsFound = REQUIRED_COLUMNS.filter((column) => columns.includes(column));
  const missingRequiredColumns = REQUIRED_COLUMNS.filter((column) => !columns.includes(column));
  const hasRiskGroup = columns.includes("risk_group");
  const warnings: FileParsingIssue[] = [];
  const issues: ValidationIssue[] = missingRequiredColumns.map((column) => ({
    code: "missing_required_column",
    message: `Required column "${column}" was not found.`,
    field: column,
  }));
  const validRecords: ValidatedInputRecord[] = [];
  let invalidRecordCount = 0;

  if (missingRequiredColumns.length === 0) {
    rows.forEach((row, index) => {
      const candidate: RawTabularRecord = {
        area: row.area,
        date: row.date,
        count: normalizeCount(row.count),
        ...(hasRiskGroup ? { risk_group: row.risk_group } : {}),
      };
      const result = validateRecords([candidate]);
      if (result.valid) validRecords.push(result.value[0] as ValidatedInputRecord);
      else {
        invalidRecordCount += 1;
        issues.push(...result.issues.map((entry) => ({
          ...entry,
          record_index: index + 2,
          message: `${entry.message} (row ${index + 2})`,
        })));
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

import type {
  AnalysisOptions,
  AnalysisResult,
  ValidatedInputRecord,
  ValidationIssue,
} from "../core";
import type { DiseasePresetSelection } from "../config";
import type { ResultViewState } from "../results";

export type SupportedFileType = "csv" | "xlsx";
export type ParsedCellValue = string | number | boolean | null;
export type ParsedRow = Record<string, ParsedCellValue>;
export type ColumnName = string;

export interface ImportedFileMetadata {
  filename: string;
  extension: SupportedFileType;
  mime_type: string;
  size_bytes: number;
  parsed_row_count: number;
  columns: ColumnName[];
  worksheet_name?: string;
}

export interface ParsedTable {
  columns: ColumnName[];
  rows: ParsedRow[];
  worksheet_name?: string;
}

export type FileIssueScope = "file" | "header" | "row" | "parser";
export type FileIssueSeverity = "error" | "warning";

export interface FileParsingIssue {
  code: string;
  message: string;
  scope: FileIssueScope;
  severity: FileIssueSeverity;
  row_number?: number;
  field?: string;
}

export type FileParsingResult =
  | {
      success: true;
      metadata: ImportedFileMetadata;
      table: ParsedTable;
      issues: FileParsingIssue[];
    }
  | {
      success: false;
      issues: FileParsingIssue[];
    };

export interface InputValidationSummary {
  valid: boolean;
  required_columns_found: string[];
  missing_required_columns: string[];
  has_risk_group: boolean;
  valid_record_count: number;
  invalid_record_count: number;
  issues: ValidationIssue[];
  warnings: FileParsingIssue[];
  valid_records: ValidatedInputRecord[];
}

export type UploadStatus =
  | "idle"
  | "parsing"
  | "parse-failed"
  | "parsed"
  | "validation-failed"
  | "input-valid"
  | "analysis-running"
  | "analysis-completed"
  | "analysis-failed";

export interface AnalysisWorkflowState {
  status: UploadStatus;
  file: File | null;
  metadata: ImportedFileMetadata | null;
  parsed_records: ParsedRow[];
  parsing_issues: FileParsingIssue[];
  validation: InputValidationSummary | null;
  disease_preset: DiseasePresetSelection;
  options: AnalysisOptions;
  analysis_result: AnalysisResult | null;
  result_view: ResultViewState;
  message: string;
}

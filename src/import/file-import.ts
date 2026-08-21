import {
  CSV_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_PARSED_ROWS,
  SUPPORTED_EXTENSIONS,
  XLSX_MIME_TYPES,
} from "./constants";
import { parseCsvText } from "./csv-parser";
import { parseExcelArrayBuffer } from "./excel-parser";
import type {
  FileParsingIssue,
  FileParsingResult,
  SupportedFileType,
} from "./types";

function failure(code: string, message: string): FileParsingResult {
  return {
    success: false,
    issues: [{ code, message, scope: "file", severity: "error" }],
  };
}

export function fileExtension(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index < 0 ? "" : filename.slice(index + 1).toLowerCase();
}

function startsWithZipSignature(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4));
  return bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

export async function importLocalFile(file: File): Promise<FileParsingResult> {
  if (file.size === 0) return failure("zero_byte_file", "Select a nonempty file.");
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return failure("file_too_large", `The file exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MiB limit.`);
  }
  const extension = fileExtension(file.name);
  if (!SUPPORTED_EXTENSIONS.includes(extension as SupportedFileType)) {
    return failure("unsupported_extension", "Supported file types are CSV and XLSX.");
  }

  const type = extension as SupportedFileType;
  const acceptedMimeTypes = type === "csv" ? CSV_MIME_TYPES : XLSX_MIME_TYPES;
  const mimeIssue: FileParsingIssue[] = acceptedMimeTypes.has(file.type)
    ? []
    : [{
        code: "unexpected_mime_type",
        message: "The browser-reported file type does not match the filename; content validation will decide whether it is usable.",
        scope: "file",
        severity: "warning",
      }];

  const buffer = await file.arrayBuffer();
  if (type === "csv" && startsWithZipSignature(buffer)) {
    return failure("content_mismatch", "The file contents appear to be a workbook, not CSV text.");
  }
  if (type === "xlsx" && !startsWithZipSignature(buffer)) {
    return failure("content_mismatch", "The file contents do not appear to be an XLSX workbook.");
  }

  const parsed = type === "csv"
    ? parseCsvText(new TextDecoder("utf-8", { fatal: false }).decode(buffer))
    : await parseExcelArrayBuffer(buffer);
  if (!parsed.success) return { success: false, issues: [...mimeIssue, ...parsed.issues] };
  if (parsed.table.rows.length > MAX_PARSED_ROWS) {
    return failure("too_many_rows", `The file exceeds the ${MAX_PARSED_ROWS.toLocaleString()} row limit.`);
  }
  return {
    success: true,
    table: parsed.table,
    metadata: {
      filename: file.name,
      extension: type,
      mime_type: file.type,
      size_bytes: file.size,
      parsed_row_count: parsed.table.rows.length,
      columns: parsed.table.columns,
      ...(parsed.table.worksheet_name === undefined ? {} : { worksheet_name: parsed.table.worksheet_name }),
    },
    issues: [...mimeIssue, ...parsed.issues],
  };
}

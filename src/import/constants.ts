export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_PARSED_ROWS = 100_000;
export const SUPPORTED_EXTENSIONS = ["csv", "xlsx"] as const;

export const CSV_MIME_TYPES = new Set([
  "",
  "text/csv",
  "text/plain",
  "application/csv",
  "application/vnd.ms-excel",
  "application/octet-stream",
]);

export const XLSX_MIME_TYPES = new Set([
  "",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/octet-stream",
]);

import type { AnalysisInterval, ProcessedCusumRecord } from "../core";
import { serializeProcessedCsv } from "./csv-export";
import type { ExportResultType } from "./types";

export interface DownloadEnvironment {
  document: Document;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

function browserDownloadEnvironment(): DownloadEnvironment {
  return {
    document,
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
  };
}

export function exportFilename(
  resultType: ExportResultType,
  interval: AnalysisInterval,
  now: Date = new Date(),
): string {
  return `cusum-${resultType}-${interval}-${now.toISOString().slice(0, 10)}.csv`;
}

export function downloadProcessedCsv(
  records: ProcessedCusumRecord[],
  resultType: ExportResultType,
  interval: AnalysisInterval,
  now: Date = new Date(),
  environment: DownloadEnvironment = browserDownloadEnvironment(),
): string {
  const filename = exportFilename(resultType, interval, now);
  const blob = new Blob([serializeProcessedCsv(records)], { type: "text/csv;charset=utf-8" });
  const objectUrl = environment.createObjectURL(blob);
  const link = environment.document.createElement("a");
  try {
    link.href = objectUrl;
    link.download = filename;
    link.hidden = true;
    environment.document.body.append(link);
    link.click();
  } finally {
    link.remove();
    environment.revokeObjectURL(objectUrl);
  }
  return filename;
}


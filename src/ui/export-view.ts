import type { AnalysisInterval, ProcessedCusumRecord } from "../core";
import { downloadProcessedCsv } from "../results";
import type { ExportResultType } from "../results";

export type CsvDownloader = (
  records: ProcessedCusumRecord[],
  resultType: ExportResultType,
  interval: AnalysisInterval,
) => string;

export const defaultCsvDownloader: CsvDownloader = (records, resultType, interval) =>
  downloadProcessedCsv(records, resultType, interval);


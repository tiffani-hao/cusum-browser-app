import type { AnalysisInterval, ProcessedCusumRecord } from "../core";
import { downloadProcessedCsv, downloadVisualizationHtml } from "../results";
import type { ExportResultType, VisualizationSnapshot } from "../results";

export type CsvDownloader = (
  records: ProcessedCusumRecord[],
  resultType: ExportResultType,
  interval: AnalysisInterval,
) => string;

export const defaultCsvDownloader: CsvDownloader = (records, resultType, interval) =>
  downloadProcessedCsv(records, resultType, interval);

export type VisualizationDownloader = (snapshot: VisualizationSnapshot) => string;

export const defaultVisualizationDownloader: VisualizationDownloader = (snapshot) =>
  downloadVisualizationHtml(snapshot);

import type { AlertEpisode, ProcessedCusumRecord } from "./types";

const SERIES_SEPARATOR = "\u0000";

export function identifyAlertEpisodes(records: readonly ProcessedCusumRecord[]): AlertEpisode[] {
  const series = new Map<string, ProcessedCusumRecord[]>();
  for (const record of records) {
    const key = seriesKey(record);
    const group = series.get(key) ?? [];
    group.push(record);
    series.set(key, group);
  }

  const episodes: AlertEpisode[] = [];
  for (const group of series.values()) {
    const ordered = [...group].sort((left, right) => left.date.localeCompare(right.date));
    let current: AlertEpisode | undefined;
    ordered.forEach((record, index) => {
      if (record.is_alert) {
        if (current === undefined) {
          current = {
            area: record.area,
            ...(record.risk_group === undefined ? {} : { risk_group: record.risk_group }),
            start_date: record.date,
            end_date: record.date,
            periods: 1,
            total_cases: record.count,
            is_active: false,
          };
        } else {
          current.end_date = record.date;
          current.periods += 1;
          current.total_cases += record.count;
        }
      } else if (current !== undefined) {
        episodes.push(current);
        current = undefined;
      }

      if (index === ordered.length - 1 && current !== undefined) {
        current.is_active = true;
        episodes.push(current);
        current = undefined;
      }
    });
  }
  return sortAlertEpisodes(episodes);
}

export function sortAlertEpisodes(episodes: readonly AlertEpisode[]): AlertEpisode[] {
  return [...episodes].sort((left, right) =>
    right.end_date.localeCompare(left.end_date) ||
    right.start_date.localeCompare(left.start_date) ||
    left.area.localeCompare(right.area) ||
    (left.risk_group ?? "").localeCompare(right.risk_group ?? "")
  );
}

export function countDisplayedAlertEpisodes(
  displayedRecords: readonly ProcessedCusumRecord[],
  completeRecords: readonly ProcessedCusumRecord[] = displayedRecords,
): number {
  const displayedAlerts = new Map<string, string[]>();
  for (const record of displayedRecords) {
    if (!record.is_alert) continue;
    const key = seriesKey(record);
    const dates = displayedAlerts.get(key) ?? [];
    dates.push(record.date);
    displayedAlerts.set(key, dates);
  }
  return identifyAlertEpisodes(completeRecords).filter((episode) => {
    const dates = displayedAlerts.get(seriesKey(episode)) ?? [];
    return dates.some((date) => date >= episode.start_date && date <= episode.end_date);
  }).length;
}

function seriesKey(record: Pick<ProcessedCusumRecord, "area" | "risk_group">): string {
  return `${record.area}${SERIES_SEPARATOR}${record.risk_group ?? ""}`;
}

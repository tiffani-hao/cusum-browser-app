import { describe, expect, it } from "vitest";
import {
  countDisplayedAlertEpisodes,
  identifyAlertEpisodes,
} from "../src/core";
import type { ProcessedCusumRecord } from "../src/core";

describe("alert episode grouping", () => {
  it("groups continuous above-threshold periods and separates later crossings", () => {
    const cusums = [2.5, 3.7, 4.2, 5.1, 4.8, 3.9, 4.3, 4.7];
    const records = cusums.map((cusum, index) => record(
      "Area A",
      `2024-${String(index + 1).padStart(2, "0")}-01`,
      cusum,
      index + 1,
    ));

    expect(identifyAlertEpisodes(records)).toEqual([
      {
        area: "Area A",
        start_date: "2024-07-01",
        end_date: "2024-08-01",
        periods: 2,
        total_cases: 15,
        is_active: true,
      },
      {
        area: "Area A",
        start_date: "2024-03-01",
        end_date: "2024-05-01",
        periods: 3,
        total_cases: 12,
        is_active: false,
      },
    ]);
  });

  it("treats equality as non-alert and supports a one-period inactive episode", () => {
    const episodes = identifyAlertEpisodes([
      record("Area A", "2024-01-01", 4, 1),
      record("Area A", "2024-02-01", 4.1, 7),
      record("Area A", "2024-03-01", 4, 2),
    ]);
    expect(episodes).toEqual([{
      area: "Area A",
      start_date: "2024-02-01",
      end_date: "2024-02-01",
      periods: 1,
      total_cases: 7,
      is_active: false,
    }]);
  });

  it("groups areas and strata independently and sorts recent episodes first", () => {
    const episodes = identifyAlertEpisodes([
      record("Area B", "2024-02-01", 5, 2, "Stratum 1"),
      record("Area A", "2024-01-01", 5, 3, "Stratum 2"),
      record("Area B", "2024-01-01", 0, 1, "Stratum 1"),
      record("Area A", "2024-02-01", 0, 4, "Stratum 2"),
      record("Area A", "2024-02-01", 5, 6, "Stratum 1"),
    ]);
    expect(episodes.map((episode) =>
      `${episode.end_date}/${episode.area}/${episode.risk_group}/${episode.is_active}`
    )).toEqual([
      "2024-02-01/Area A/Stratum 1/true",
      "2024-02-01/Area B/Stratum 1/true",
      "2024-01-01/Area A/Stratum 2/false",
    ]);
  });

  it("counts displayed episodes using complete series boundaries", () => {
    const complete = [
      record("Area A", "2024-01-01", 5, 1),
      record("Area A", "2024-02-01", 0, 1),
      record("Area A", "2024-03-01", 5, 1),
    ];
    const displayedAlertPeriods = complete.filter((item) => item.is_alert);
    expect(countDisplayedAlertEpisodes(displayedAlertPeriods, complete)).toBe(2);
  });

  it("returns no episodes when no periods are above threshold", () => {
    expect(identifyAlertEpisodes([
      record("Area A", "2024-01-01", 0, 1),
      record("Area B", "2024-01-01", 4, 2),
    ])).toEqual([]);
  });
});

function record(
  area: string,
  date: string,
  cusum: number,
  count: number,
  riskGroup?: string,
): ProcessedCusumRecord {
  const threshold = 4;
  return {
    area,
    ...(riskGroup === undefined ? {} : { risk_group: riskGroup }),
    date,
    count,
    smoothed_count: count,
    baseline_mean: 0,
    baseline_std: 1,
    normalized_count: cusum,
    cusum,
    threshold,
    is_alert: cusum > threshold,
  };
}

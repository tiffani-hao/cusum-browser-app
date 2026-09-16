import { describe, expect, it } from "vitest";
import {
  CHART_PIXELS_PER_INTERVAL,
  chartWidthForIntervals,
  MAX_CHART_WIDTH_PX,
} from "../src/results";

describe("responsive chart width", () => {
  it("fits short time series to the available container", () => {
    expect(chartWidthForIntervals(12, 900)).toBe(900);
  });

  it("expands long time series using the interval pitch", () => {
    expect(chartWidthForIntervals(200, 900)).toBe(200 * CHART_PIXELS_PER_INTERVAL);
  });

  it("caps very long charts at a safe maximum width", () => {
    expect(chartWidthForIntervals(100_000, 900)).toBe(MAX_CHART_WIDTH_PX);
    expect(chartWidthForIntervals(12, MAX_CHART_WIDTH_PX + 1000)).toBe(MAX_CHART_WIDTH_PX);
  });
});

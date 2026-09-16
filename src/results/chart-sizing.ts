export const CHART_PIXELS_PER_INTERVAL = 12;
export const MAX_CHART_WIDTH_PX = 8192;

export function chartWidthForIntervals(
  intervalCount: number,
  containerWidth: number,
): number {
  const safeContainerWidth = Math.max(0, Math.floor(containerWidth));
  const safeIntervalCount = Math.max(0, Math.floor(intervalCount));
  const preferredWidth = safeIntervalCount * CHART_PIXELS_PER_INTERVAL;
  return Math.min(MAX_CHART_WIDTH_PX, Math.max(safeContainerWidth, preferredWidth));
}

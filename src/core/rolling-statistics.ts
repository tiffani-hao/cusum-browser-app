export function trailingMean(values: number[], index: number, window: number): number {
  const start = Math.max(0, index - window + 1);
  let sum = 0;
  for (let cursor = start; cursor <= index; cursor += 1) sum += values[cursor] ?? 0;
  return sum / (index - start + 1);
}

export function trailingSampleStandardDeviation(values: number[], index: number, window: number): number {
  const start = Math.max(0, index - window + 1);
  const size = index - start + 1;
  if (size < 2) return 1;
  const mean = trailingMean(values, index, window);
  let squaredDifferenceSum = 0;
  for (let cursor = start; cursor <= index; cursor += 1) {
    const difference = (values[cursor] ?? 0) - mean;
    squaredDifferenceSum += difference * difference;
  }
  const standardDeviation = Math.sqrt(squaredDifferenceSum / (size - 1));
  return standardDeviation === 0 ? 1 : standardDeviation;
}

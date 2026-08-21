import type { AnalysisInterval } from "./types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatIsoDate(date: Date): string {
  const year = String(date.getUTCFullYear()).padStart(4, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function standardizeDate(date: string, interval: AnalysisInterval): string {
  const parsed = parseIsoDate(date);
  if (parsed === null) throw new Error(`Invalid validated date: ${date}`);
  if (interval === "weekly") {
    const daysFromMonday = (parsed.getUTCDay() + 6) % 7;
    parsed.setUTCDate(parsed.getUTCDate() - daysFromMonday);
  } else if (interval === "monthly") {
    parsed.setUTCDate(1);
  }
  return formatIsoDate(parsed);
}

export function nextPeriod(date: string, interval: AnalysisInterval): string {
  const parsed = parseIsoDate(date);
  if (parsed === null) throw new Error(`Invalid validated date: ${date}`);
  if (interval === "daily") parsed.setUTCDate(parsed.getUTCDate() + 1);
  if (interval === "weekly") parsed.setUTCDate(parsed.getUTCDate() + 7);
  if (interval === "monthly") parsed.setUTCMonth(parsed.getUTCMonth() + 1, 1);
  return formatIsoDate(parsed);
}

export function compareDates(left: string, right: string): number {
  return left.localeCompare(right);
}

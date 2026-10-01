import { formatIsoDate, parseIsoDate } from "../core";
import { excelSerialDateToIso, numericDateSerial } from "./excel-serial-date";

export type NumericSlashDateOrder = "month-first" | "day-first";

export interface DateColumnFormat {
  order: NumericSlashDateOrder;
  ambiguous: boolean;
  conflict_rows: number[];
}

export type ImportedDateNormalization =
  | { valid: true; value: string }
  | { valid: false; code: "invalid_excel_serial_date" | "invalid_date" };

const MONTHS = new Map<string, number>([
  ["jan", 1], ["january", 1],
  ["feb", 2], ["february", 2],
  ["mar", 3], ["march", 3],
  ["apr", 4], ["april", 4],
  ["may", 5],
  ["jun", 6], ["june", 6],
  ["jul", 7], ["july", 7],
  ["aug", 8], ["august", 8],
  ["sep", 9], ["sept", 9], ["september", 9],
  ["oct", 10], ["october", 10],
  ["nov", 11], ["november", 11],
  ["dec", 12], ["december", 12],
]);

const SLASH_DATE = /^(\d{1,4})\/(\d{1,2})\/(\d{1,4})$/;
const ISO_DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)$/i;
const MONTH_FIRST_TEXT = /^([A-Za-z]+)\s+(\d{1,2})(?:,)?\s+(\d{4})$/;
const DAY_FIRST_TEXT = /^(\d{1,2})(?:-|\s)([A-Za-z]+)(?:-|\s)(\d{4})$/;

export function inspectDateColumn(values: readonly unknown[]): DateColumnFormat {
  const monthFirstRows: number[] = [];
  const dayFirstRows: number[] = [];
  let ambiguous = false;

  values.forEach((value, index) => {
    if (typeof value !== "string") return;
    const match = SLASH_DATE.exec(stripValidTimeSuffix(value.trim()));
    if (match === null || match[1]?.length === 4) return;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12 && second >= 1 && second <= 12) dayFirstRows.push(index + 2);
    else if (second > 12 && first >= 1 && first <= 12) monthFirstRows.push(index + 2);
    else if (first >= 1 && first <= 12 && second >= 1 && second <= 12) ambiguous = true;
  });

  return {
    order: dayFirstRows.length > 0 && monthFirstRows.length === 0 ? "day-first" : "month-first",
    ambiguous: ambiguous && dayFirstRows.length === 0 && monthFirstRows.length === 0,
    conflict_rows: dayFirstRows.length > 0 && monthFirstRows.length > 0
      ? [dayFirstRows[0]!, monthFirstRows[0]!]
      : [],
  };
}

export function normalizeImportedDate(
  value: unknown,
  slashOrder: NumericSlashDateOrder,
): ImportedDateNormalization {
  const serial = numericDateSerial(value);
  if (serial !== undefined) {
    const converted = excelSerialDateToIso(serial);
    return converted === null
      ? { valid: false, code: "invalid_excel_serial_date" }
      : { valid: true, value: converted };
  }
  if (typeof value !== "string") return { valid: false, code: "invalid_date" };
  const trimmed = value.trim();
  if (trimmed === "") return { valid: false, code: "invalid_date" };

  const iso = parseIsoDate(trimmed);
  if (iso !== null) return { valid: true, value: formatIsoDate(iso) };

  const dateTime = ISO_DATE_TIME.exec(trimmed);
  if (dateTime !== null) {
    const date = parseIsoDate(dateTime[1]!);
    if (date !== null && validTime(dateTime[2], dateTime[3], dateTime[4])) {
      return { valid: true, value: formatIsoDate(date) };
    }
    return { valid: false, code: "invalid_date" };
  }

  const withoutTime = stripValidTimeSuffix(trimmed);
  const slash = SLASH_DATE.exec(withoutTime);
  if (slash !== null) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const yearPart = slash[3]!;
    if (slash[1]?.length === 4 && yearPart.length <= 2) {
      return calendarDate(first, second, Number(yearPart));
    }
    if (yearPart.length !== 2 && yearPart.length !== 4) return { valid: false, code: "invalid_date" };
    const year = expandYear(Number(yearPart), yearPart.length);
    return slashOrder === "day-first"
      ? calendarDate(year, second, first)
      : calendarDate(year, first, second);
  }

  const monthFirst = MONTH_FIRST_TEXT.exec(withoutTime);
  if (monthFirst !== null) {
    const month = MONTHS.get(monthFirst[1]!.toLowerCase());
    return month === undefined
      ? { valid: false, code: "invalid_date" }
      : calendarDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
  }

  const dayFirst = DAY_FIRST_TEXT.exec(withoutTime);
  if (dayFirst !== null) {
    const month = MONTHS.get(dayFirst[2]!.toLowerCase());
    return month === undefined
      ? { valid: false, code: "invalid_date" }
      : calendarDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
  }

  return { valid: false, code: "invalid_date" };
}

function stripValidTimeSuffix(value: string): string {
  const match = /^(.*?)(?:[ T])(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?$/i.exec(value);
  if (match === null || !validTime(match[2], match[3], match[4])) return value;
  return match[1]!.trim();
}

function validTime(hour: string | undefined, minute: string | undefined, second: string | undefined): boolean {
  if (hour === undefined || minute === undefined) return false;
  const hourValue = Number(hour);
  const minuteValue = Number(minute);
  const secondValue = second === undefined ? 0 : Number(second);
  return hourValue >= 0 && hourValue <= 23 && minuteValue >= 0 && minuteValue <= 59 &&
    secondValue >= 0 && secondValue <= 59;
}

function expandYear(year: number, digits: number): number {
  if (digits === 4) return year;
  return year <= 69 ? 2000 + year : 1900 + year;
}

function calendarDate(year: number, month: number, day: number): ImportedDateNormalization {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return { valid: false, code: "invalid_date" };
  }
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = parseIsoDate(iso);
  return parsed === null
    ? { valid: false, code: "invalid_date" }
    : { valid: true, value: formatIsoDate(parsed) };
}

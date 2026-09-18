const EXCEL_1900_EPOCH_UTC = Date.UTC(1899, 11, 31);
const EXCEL_LEAP_YEAR_BUG_SERIAL = 60;
const MAX_EXCEL_SERIAL = 2_958_465;
const MILLISECONDS_PER_DAY = 86_400_000;

export function excelSerialDateToIso(serial: number): string | null {
  if (
    !Number.isSafeInteger(serial) ||
    serial < 1 ||
    serial > MAX_EXCEL_SERIAL ||
    serial === EXCEL_LEAP_YEAR_BUG_SERIAL
  ) {
    return null;
  }
  const correctedSerial = serial > EXCEL_LEAP_YEAR_BUG_SERIAL ? serial - 1 : serial;
  const date = new Date(EXCEL_1900_EPOCH_UTC + correctedSerial * MILLISECONDS_PER_DAY);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function numericDateSerial(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return undefined;
  return Number(trimmed);
}

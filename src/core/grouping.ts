import type {
  IndependentSeriesDefinition,
  StandardizedRecord,
  ValidatedInputRecord,
} from "./types";

const KEY_SEPARATOR = "\u0000";

export function defineSeries(record: ValidatedInputRecord, groupByRiskGroup: boolean): IndependentSeriesDefinition {
  const riskGroup = groupByRiskGroup ? (record.risk_group ?? "").trim() : undefined;
  return {
    key: groupByRiskGroup ? `${record.area}${KEY_SEPARATOR}${riskGroup}` : record.area,
    area: record.area,
    ...(riskGroup === undefined ? {} : { risk_group: riskGroup }),
  };
}

export function compareRecords(left: StandardizedRecord, right: StandardizedRecord): number {
  return (
    left.area.localeCompare(right.area) ||
    (left.risk_group ?? "").localeCompare(right.risk_group ?? "") ||
    left.date.localeCompare(right.date)
  );
}

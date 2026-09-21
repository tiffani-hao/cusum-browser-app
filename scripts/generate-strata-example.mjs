import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// This generator creates synthetic demonstration data only. It contains no
// observed surveillance records and uses no random input.
const AREAS = [
  { name: "Area A", baseline: 2 },
  { name: "Area B", baseline: 4 },
  { name: "Area C", baseline: 6 },
  { name: "Area D", baseline: 3 },
];

const STRATA = [
  { name: "Group 1", baseline: 0 },
  { name: "Group 2", baseline: 2 },
  { name: "Group 3", baseline: 4 },
];

const SEASONAL_VARIATION = [0, 1, 0, 0, 1, 2, 1, 0, 0, 1, 2, 0];
const START_YEAR = 2019;
const MONTH_COUNT = 84;

const SUSTAINED_INCREASES = [
  {
    area: "Area A",
    stratum: "Group 1",
    start: "2022-03-01",
    end: "2022-11-01",
    increase: 5,
  },
  {
    area: "Area B",
    stratum: "Group 2",
    start: "2023-09-01",
    end: "2024-05-01",
    increase: 6,
  },
  {
    area: "Area C",
    stratum: "Group 3",
    start: "2025-02-01",
    end: "2025-10-01",
    increase: 7,
  },
];

function isoMonth(monthIndex) {
  const year = START_YEAR + Math.floor(monthIndex / 12);
  const month = monthIndex % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function syntheticCount(area, stratum, areaIndex, stratumIndex, monthIndex, date) {
  // Area D provides stable comparison series at three distinct group baselines.
  if (area.name === "Area D") {
    return area.baseline + stratum.baseline;
  }

  const month = monthIndex % 12;
  const yearIndex = Math.floor(monthIndex / 12);
  const seasonal = SEASONAL_VARIATION[
    (month + areaIndex * 2 + stratumIndex * 3) % SEASONAL_VARIATION.length
  ];
  const modestYearVariation = (yearIndex + areaIndex + stratumIndex) % 3 === 0 ? 1 : 0;
  const sustainedIncrease = SUSTAINED_INCREASES.find((pattern) =>
    pattern.area === area.name &&
    pattern.stratum === stratum.name &&
    date >= pattern.start &&
    date <= pattern.end
  )?.increase ?? 0;

  return area.baseline + stratum.baseline + seasonal +
    modestYearVariation + sustainedIncrease;
}

export function generateStrataExample() {
  const rows = ["area,date,count,strata"];
  for (const [areaIndex, area] of AREAS.entries()) {
    for (const [stratumIndex, stratum] of STRATA.entries()) {
      for (let monthIndex = 0; monthIndex < MONTH_COUNT; monthIndex += 1) {
        const date = isoMonth(monthIndex);
        const count = syntheticCount(
          area,
          stratum,
          areaIndex,
          stratumIndex,
          monthIndex,
          date,
        );
        rows.push(`${area.name},${date},${count},${stratum.name}`);
      }
    }
  }
  return `${rows.join("\n")}\n`;
}

const outputPath = fileURLToPath(
  new URL("../sample-data/strata-example.csv", import.meta.url),
);
writeFileSync(outputPath, generateStrataExample(), "utf8");

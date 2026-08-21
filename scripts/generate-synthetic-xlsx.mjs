import { writeFileSync } from "node:fs";
import { strToU8, zipSync } from "fflate";

const rows = [
  ["area", "date", "count"],
  ["Area A", "2024-01-01", 1],
  ["Area A", "2024-02-01", 2],
  ["Area A", "2024-03-01", 8],
];

function cell(value, address) {
  if (typeof value === "number") return `<c r="${address}"><v>${value}</v></c>`;
  return `<c r="${address}" t="inlineStr"><is><t>${value}</t></is></c>`;
}

const sheetRows = rows.map((values, rowIndex) => {
  const cells = values.map((value, columnIndex) =>
    cell(value, `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`)).join("");
  return `<row r="${rowIndex + 1}">${cells}</row>`;
}).join("");

const files = {
  "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    </Types>`),
  "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`),
  "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="Synthetic data" sheetId="1" r:id="rId1"/></sheets>
    </workbook>`),
  "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
    </Relationships>`),
  "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>${sheetRows}</sheetData>
    </worksheet>`),
};

writeFileSync(new URL("../sample-data/synthetic-example.xlsx", import.meta.url), zipSync(files));

import { strToU8, zipSync } from "fflate";

export type TestCell = string | number | boolean | null | { formula: string; value: number };

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function columnName(index: number): string {
  let current = index + 1;
  let output = "";
  while (current > 0) {
    current -= 1;
    output = String.fromCharCode(65 + current % 26) + output;
    current = Math.floor(current / 26);
  }
  return output;
}

function cellXml(cell: TestCell, row: number, column: number): string {
  if (cell === null) return "";
  const address = `${columnName(column)}${row}`;
  if (typeof cell === "number") return `<c r="${address}"><v>${cell}</v></c>`;
  if (typeof cell === "boolean") return `<c r="${address}" t="b"><v>${cell ? 1 : 0}</v></c>`;
  if (typeof cell === "object") {
    return `<c r="${address}"><f>${escapeXml(cell.formula)}</f><v>${cell.value}</v></c>`;
  }
  return `<c r="${address}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
}

function worksheetXml(rows: readonly (readonly TestCell[])[]): string {
  const rowXml = rows.map((cells, rowIndex) =>
    `<row r="${rowIndex + 1}">${cells.map((cell, columnIndex) =>
      cellXml(cell, rowIndex + 1, columnIndex)).join("")}</row>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetData>${rowXml}</sheetData>
    </worksheet>`;
}

export function createXlsxBuffer(
  sheets: readonly { readonly name: string; readonly rows: readonly (readonly TestCell[])[] }[],
): ArrayBuffer {
  const sheetEntries = sheets.map((sheet, index) =>
    `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");
  const relationships = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");
  const overrides = sheets.map((_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
        <Default Extension="xml" ContentType="application/xml"/>
        <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
        ${overrides}
      </Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      </Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
        xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
        <sheets>${sheetEntries}</sheets>
      </workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        ${relationships}
      </Relationships>`),
  };
  sheets.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet.rows));
  });
  const zipped = zipSync(files);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer;
}

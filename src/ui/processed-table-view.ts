import type { ProcessedCusumRecord } from "../core";
import { formatResultNumber, paginateRecords, PROCESSED_PAGE_SIZES } from "../results";

export interface ProcessedTableActions {
  setPage(page: number): void;
  setPageSize(pageSize: number): void;
}

export function renderProcessedTable(
  container: HTMLElement,
  records: ProcessedCusumRecord[],
  requestedPage: number,
  pageSize: number,
  actions: ProcessedTableActions,
): void {
  container.replaceChildren();
  const page = paginateRecords(records, requestedPage, pageSize);
  const includesRisk = records.some((record) => record.risk_group !== undefined);
  const controls = document.createElement("div");
  controls.className = "table-toolbar";
  const range = document.createElement("p");
  range.textContent = `${page.range_start.toLocaleString()}–${page.range_end.toLocaleString()} of ` +
    `${page.total_records.toLocaleString()} filtered records · page ${page.page} of ${page.total_pages}`;
  const pageSizeLabel = document.createElement("label");
  pageSizeLabel.textContent = "Rows per page ";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Processed table rows per page");
  PROCESSED_PAGE_SIZES.forEach((size) => {
    const option = document.createElement("option");
    option.value = String(size);
    option.textContent = String(size);
    option.selected = size === page.page_size;
    select.append(option);
  });
  select.addEventListener("change", () => actions.setPageSize(Number(select.value)));
  pageSizeLabel.append(select);
  controls.append(range, pageSizeLabel);

  if (records.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No processed records match the current display filters.";
    container.append(controls, empty);
    return;
  }

  const fields: { label: string; value(record: ProcessedCusumRecord): string }[] = [
    { label: "Area", value: (record) => record.area },
    ...(includesRisk ? [{ label: "Risk group", value: (record: ProcessedCusumRecord) => record.risk_group ?? "" }] : []),
    { label: "Date", value: (record) => record.date },
    { label: "Count", value: (record) => String(record.count) },
    { label: "Normalized count", value: (record) => formatResultNumber(record.normalized_count) },
    { label: "CUSUM", value: (record) => formatResultNumber(record.cusum) },
    { label: "Threshold", value: (record) => formatResultNumber(record.threshold) },
    { label: "Alert status", value: (record) => record.is_alert ? "Alert" : "No alert" },
  ];
  const wrap = document.createElement("div");
  wrap.className = "table-scroll";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = "Key processed CUSUM results; tabular alternative to the chart";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  fields.forEach((field) => {
    const header = document.createElement("th");
    header.scope = "col";
    header.textContent = field.label;
    headerRow.append(header);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");
  page.records.forEach((record) => {
    const row = document.createElement("tr");
    if (record.is_alert) row.className = "alert-row";
    fields.forEach((field) => {
      const cell = document.createElement("td");
      cell.textContent = field.value(record);
      row.append(cell);
    });
    body.append(row);
  });
  table.append(caption, head, body);
  wrap.append(table);

  const pagination = document.createElement("div");
  pagination.className = "pagination";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "button button-secondary";
  previous.textContent = "Previous page";
  previous.disabled = page.page <= 1;
  previous.addEventListener("click", () => actions.setPage(page.page - 1));
  const next = document.createElement("button");
  next.type = "button";
  next.className = "button button-secondary";
  next.textContent = "Next page";
  next.disabled = page.page >= page.total_pages;
  next.addEventListener("click", () => actions.setPage(page.page + 1));
  pagination.append(previous, next);
  container.append(controls, wrap, pagination);
}

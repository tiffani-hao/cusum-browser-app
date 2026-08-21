import type { ProcessedCusumRecord } from "../core";
import { formatResultNumber, paginateRecords, sortAlertRecords } from "../results";

const ALERT_PREVIEW_SIZE = 5;

export interface AlertTableActions {
  setPage(page: number): void;
  setExpanded(expanded: boolean): void;
}

export function renderAlertTable(
  container: HTMLElement,
  records: ProcessedCusumRecord[],
  requestedPage: number,
  pageSize: number,
  expanded: boolean,
  actions: AlertTableActions,
): void {
  container.replaceChildren();
  const sorted = sortAlertRecords(records);
  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state alert-empty-state";
    empty.textContent = "No alerts match the current display filters.";
    container.append(empty);
    return;
  }

  container.append(alertSummary(sorted));
  const visible = expanded
    ? paginateRecords(sorted, requestedPage, pageSize)
    : paginateRecords(sorted.slice(0, ALERT_PREVIEW_SIZE), 1, ALERT_PREVIEW_SIZE);
  container.append(alertTable(visible.records, sorted));

  const actionsRow = document.createElement("div");
  actionsRow.className = "alert-actions";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "button button-secondary";
  toggle.textContent = expanded ? "Collapse alerts" : `Show all alerts (${sorted.length.toLocaleString()})`;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.addEventListener("click", () => actions.setExpanded(!expanded));
  actionsRow.append(toggle);
  if (expanded && visible.total_pages > 1) {
    actionsRow.append(paginationControls(visible.page, visible.total_pages, actions.setPage));
  }
  container.append(actionsRow);
}

function alertSummary(records: ProcessedCusumRecord[]): HTMLElement {
  const list = document.createElement("dl");
  list.className = "alert-summary";
  const affectedGroups = new Set(records.map((record) =>
    `${record.area}\u0000${record.risk_group ?? ""}`
  )).size;
  const values: [string, string][] = [
    ["Displayed alerts", records.length.toLocaleString()],
    ["Affected area groups", affectedGroups.toLocaleString()],
    ["Most recent date", records[0]?.date ?? "—"],
    ["Highest CUSUM", formatResultNumber(Math.max(...records.map((record) => record.cusum)))],
  ];
  values.forEach(([term, value]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    wrapper.append(dt, dd);
    list.append(wrapper);
  });
  return list;
}

function alertTable(
  records: ProcessedCusumRecord[],
  allAlerts: ProcessedCusumRecord[],
): HTMLElement {
  const includesRisk = allAlerts.some((record) => record.risk_group !== undefined);
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-scroll alert-table-scroll";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = "Alert records, sorted by date descending, then area and risk group";
  table.append(caption);
  const headers = ["Area", ...(includesRisk ? ["Risk group"] : []), "Date", "Count", "CUSUM"];
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headers.forEach((label) => {
    const header = document.createElement("th");
    header.scope = "col";
    header.textContent = label;
    headerRow.append(header);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");
  records.forEach((record) => {
    const row = document.createElement("tr");
    const values = [
      record.area,
      ...(includesRisk ? [record.risk_group ?? ""] : []),
      record.date,
      String(record.count),
      formatResultNumber(record.cusum),
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  tableWrap.append(table);
  return tableWrap;
}

function paginationControls(page: number, totalPages: number, setPage: (page: number) => void): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "pagination alert-pagination";
  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = "button button-secondary";
  previous.textContent = "Previous alerts";
  previous.disabled = page <= 1;
  previous.addEventListener("click", () => setPage(page - 1));
  const status = document.createElement("span");
  status.textContent = `Alert page ${page} of ${totalPages}`;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "button button-secondary";
  next.textContent = "Next alerts";
  next.disabled = page >= totalPages;
  next.addEventListener("click", () => setPage(page + 1));
  controls.append(previous, status, next);
  return controls;
}

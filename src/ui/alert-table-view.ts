import { sortAlertEpisodes } from "../core";
import type { AlertEpisode } from "../core";
import {
  formatResultNumber,
  paginateRecords,
} from "../results";

const ALERT_PREVIEW_SIZE = 5;

export interface AlertTableActions {
  setPage(page: number): void;
  setExpanded(expanded: boolean): void;
  setShowInactive(showInactive: boolean): void;
}

export function renderAlertTable(
  container: HTMLElement,
  allEpisodes: AlertEpisode[],
  filteredEpisodes: AlertEpisode[],
  requestedPage: number,
  pageSize: number,
  expanded: boolean,
  showInactive: boolean,
  actions: AlertTableActions,
): void {
  container.replaceChildren();
  const complete = sortAlertEpisodes(allEpisodes);
  const sorted = sortAlertEpisodes(filteredEpisodes);
  const displayed = showInactive ? sorted : sorted.filter((episode) => episode.is_active);
  container.append(alertSummary(complete));
  container.append(inactiveAlertControl(showInactive, actions.setShowInactive));

  if (displayed.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state alert-empty-state";
    empty.textContent = !showInactive && sorted.length > 0
      ? "No currently active alert episodes match the current display filters. Turn on Show inactive alerts to review past episodes."
      : "No alert episodes match the current display filters.";
    container.append(empty);
    return;
  }

  const visible = expanded
    ? paginateRecords(displayed, requestedPage, pageSize)
    : paginateRecords(displayed.slice(0, ALERT_PREVIEW_SIZE), 1, ALERT_PREVIEW_SIZE);
  container.append(alertTable(visible.records));

  const actionsRow = document.createElement("div");
  actionsRow.className = "alert-actions";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "button button-secondary";
  toggle.textContent = expanded
    ? "Collapse alert episodes"
    : `Show all alert episodes (${displayed.length.toLocaleString()})`;
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.addEventListener("click", () => actions.setExpanded(!expanded));
  actionsRow.append(toggle);
  if (expanded && visible.total_pages > 1) {
    actionsRow.append(paginationControls(visible.page, visible.total_pages, actions.setPage));
  }
  container.append(actionsRow);
}

function inactiveAlertControl(
  checked: boolean,
  setShowInactive: (showInactive: boolean) => void,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "toggle-label compact alert-history-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => setShowInactive(input.checked));
  const text = document.createElement("span");
  text.textContent = "Show inactive alerts";
  label.append(input, text);
  return label;
}

function alertSummary(episodes: AlertEpisode[]): HTMLElement {
  const list = document.createElement("dl");
  list.className = "alert-summary";
  const affectedSeries = new Set(episodes.map((episode) =>
    `${episode.area}\u0000${episode.risk_group ?? ""}`
  )).size;
  const activeCount = episodes.filter((episode) => episode.is_active).length;
  const values: [string, string][] = [
    ["Total alert episodes", episodes.length.toLocaleString()],
    ["Currently active", activeCount.toLocaleString()],
    ["Inactive", (episodes.length - activeCount).toLocaleString()],
    ["Series with alerts", affectedSeries.toLocaleString()],
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

function alertTable(episodes: AlertEpisode[]): HTMLElement {
  const tableWrap = document.createElement("div");
  tableWrap.className = "table-scroll alert-table-scroll";
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = "Alert episodes, sorted by most recent end date, then start date, area, and strata";
  table.append(caption);
  const headers = ["Area", "Strata", "Start Date", "End Date", "Periods", "Total Cases"];
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
  episodes.forEach((episode) => {
    const row = document.createElement("tr");
    row.className = episode.is_active ? "active-alert-episode" : "inactive-alert-episode";
    row.setAttribute("aria-label", episode.is_active ? "Currently active alert episode" : "Inactive alert episode");
    const values = [
      episode.area,
      episode.risk_group ?? "—",
      episode.start_date,
      episode.end_date,
      episode.periods.toLocaleString(),
      formatResultNumber(episode.total_cases),
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
  previous.textContent = "Previous alert episodes";
  previous.disabled = page <= 1;
  previous.addEventListener("click", () => setPage(page - 1));
  const status = document.createElement("span");
  status.textContent = `Alert episode page ${page} of ${totalPages}`;
  const next = document.createElement("button");
  next.type = "button";
  next.className = "button button-secondary";
  next.textContent = "Next alert episodes";
  next.disabled = page >= totalPages;
  next.addEventListener("click", () => setPage(page + 1));
  controls.append(previous, status, next);
  return controls;
}

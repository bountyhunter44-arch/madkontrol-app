import { db } from "/core/firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const RESPONSE_COLLECTION = "local_event_responses";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function buildCsv(rows) {
  const headers = [
    "noteId",
    "eventId",
    "restaurantId",
    "userName",
    "contact",
    "attending",
    "shareWithText",
    "competitionOptIn",
    "sourceModule"
  ];
  return [
    headers.map(toCsvCell).join(","),
    ...rows.map((row) => headers.map((header) => toCsvCell(row[header])).join(","))
  ].join("\n");
}

function downloadCsv(rows, fileName) {
  const blob = new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadResponses(filters = {}) {
  const constraints = [];
  if (filters.eventId) constraints.push(where("eventId", "==", filters.eventId));
  if (filters.restaurantId) constraints.push(where("restaurantId", "==", filters.restaurantId));
  if (filters.companyId) constraints.push(where("companyId", "==", filters.companyId));
  if (filters.locationId) constraints.push(where("locationId", "==", filters.locationId));

  const snapshot = await getDocs(query(collection(db, RESPONSE_COLLECTION), ...constraints));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function summarize(rows) {
  return {
    clicks: rows.length,
    attendingYes: rows.filter((row) => row.responseType !== "click" && row.attending === true).length,
    competitionParticipants: rows.filter((row) => row.competitionOptIn === true).length
  };
}

function renderSummary(container, rows) {
  const summary = summarize(rows);
  container.innerHTML = `
    <div class="local-event-admin-summary">
      <div><strong>${summary.clicks}</strong><span>Klik/svar</span></div>
      <div><strong>${summary.attendingYes}</strong><span>Ja</span></div>
      <div><strong>${summary.competitionParticipants}</strong><span>Konkurrence</span></div>
    </div>
    <div class="local-event-admin-actions">
      <button type="button" class="local-event-secondary" data-local-event-export>Eksport CSV</button>
    </div>
    <div class="local-event-admin-list">
      ${rows.slice(0, 25).map((row) => `
        <article>
          <strong>${escapeHtml(row.userName || (row.responseType === "click" ? "Klik" : "Anonym"))}</strong>
          <span>${escapeHtml(row.contact || "Ingen kontakt")}</span>
          <small>${row.responseType === "click" ? "Åbnede event" : (row.attending ? "Deltager" : "Deltager ikke")}${row.competitionOptIn ? " · Konkurrence" : ""}</small>
        </article>
      `).join("") || "<p>Ingen svar endnu.</p>"}
    </div>
  `;
  container.querySelector("[data-local-event-export]")?.addEventListener("click", () => {
    downloadCsv(rows, `local-event-responses-${Date.now()}.csv`);
  });
}

export async function initLocalEventAdmin(root = document) {
  const panels = Array.from(root.querySelectorAll("[data-local-event-admin]"));
  await Promise.all(panels.map(async (panel) => {
    if (panel.dataset.localEventAdminBound === "true") return;
    panel.dataset.localEventAdminBound = "true";
    panel.innerHTML = "<p>Indlæser event-svar...</p>";
    try {
      const rows = await loadResponses({
        eventId: panel.dataset.eventId,
        restaurantId: panel.dataset.restaurantId,
        companyId: panel.dataset.companyId,
        locationId: panel.dataset.locationId
      });
      renderSummary(panel, rows);
    } catch (error) {
      console.error("[local event] admin load failed", error);
      panel.innerHTML = "<p>Event-svar kunne ikke indlæses.</p>";
    }
  }));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initLocalEventAdmin());
} else {
  initLocalEventAdmin();
}

window.MKP = window.MKP || {};
window.MKP.LocalEvents = {
  ...(window.MKP.LocalEvents || {}),
  initAdmin: initLocalEventAdmin
};

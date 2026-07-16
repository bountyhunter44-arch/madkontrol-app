import { openLocalEventModal, hasDismissedLocalEvent } from "./local-event-modal.js";

function readEventData(element) {
  return {
    noteId: element.dataset.noteId,
    eventId: element.dataset.eventId,
    restaurantId: element.dataset.restaurantId,
    restaurantName: element.dataset.restaurantName,
    companyId: element.dataset.companyId,
    locationId: element.dataset.locationId,
    title: element.dataset.title,
    startsAt: element.dataset.startsAt,
    place: element.dataset.place,
    summary: element.dataset.summary,
    sourceModule: element.dataset.sourceModule || "local-events"
  };
}

export function createLocalEventNote(eventData = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "local-event-note";
  button.textContent = "Se event her";
  Object.entries(eventData).forEach(([key, value]) => {
    if (value != null) {
      button.dataset[key] = String(value);
    }
  });
  button.addEventListener("click", () => openLocalEventModal(eventData));
  return button;
}

export function initLocalEventNotes(root = document) {
  const notes = Array.from(root.querySelectorAll("[data-local-event-note]"));
  notes.forEach((note) => {
    if (note.dataset.localEventBound === "true") return;
    note.dataset.localEventBound = "true";
    const eventData = readEventData(note);

    if (note.dataset.hideWhenDismissed === "true" && hasDismissedLocalEvent(eventData)) {
      note.hidden = true;
      return;
    }

    if (!note.textContent.trim()) {
      note.textContent = "Se event her";
    }

    if (!note.classList.contains("local-event-note")) {
      note.classList.add("local-event-note");
    }

    note.addEventListener("click", () => openLocalEventModal(eventData));
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initLocalEventNotes());
} else {
  initLocalEventNotes();
}

window.MKP = window.MKP || {};
window.MKP.LocalEvents = {
  ...(window.MKP.LocalEvents || {}),
  createNote: createLocalEventNote,
  initNotes: initLocalEventNotes
};

import { db } from "/core/firebase-config.js";
import {
  addDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const RESPONSE_COLLECTION = "local_event_responses";
const DISMISS_PREFIX = "mkp_local_event_dismissed_";
const CLICK_PREFIX = "mkp_local_event_clicked_";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function asBool(value) {
  return value === true || value === "true" || value === "1";
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function getDismissKey(eventData) {
  return `${DISMISS_PREFIX}${cleanText(eventData.noteId || eventData.eventId || "event", 120)}`;
}

function getClickKey(eventData) {
  return `${CLICK_PREFIX}${cleanText(eventData.noteId || eventData.eventId || "event", 120)}`;
}

function markDismissed(eventData) {
  try {
    localStorage.setItem(getDismissKey(eventData), new Date().toISOString());
  } catch (error) {
    console.warn("[local event] dismiss storage failed", error);
  }
}

function isDismissed(eventData) {
  try {
    return Boolean(localStorage.getItem(getDismissKey(eventData)));
  } catch (_error) {
    return false;
  }
}

function normalizeEventData(input = {}) {
  return {
    noteId: cleanText(input.noteId || input.id || input.dataset?.noteId, 160),
    eventId: cleanText(input.eventId || input.dataset?.eventId, 160),
    restaurantId: cleanText(input.restaurantId || input.companyId || input.dataset?.restaurantId, 160),
    restaurantName: cleanText(input.restaurantName || input.companyName || input.dataset?.restaurantName, 160) || "restauranten",
    companyId: cleanText(input.companyId || input.restaurantId || input.dataset?.companyId, 160),
    locationId: cleanText(input.locationId || input.dataset?.locationId, 160),
    title: cleanText(input.title || input.eventTitle || input.dataset?.title, 180) || "Lokalt event",
    startsAt: cleanText(input.startsAt || input.dateTime || input.dataset?.startsAt, 160),
    place: cleanText(input.place || input.venue || input.dataset?.place, 180),
    summary: cleanText(input.summary || input.description || input.dataset?.summary, 700),
    sourceModule: cleanText(input.sourceModule || input.dataset?.sourceModule, 120) || "local-events",
    dismissible: input.dismissible === false ? false : true
  };
}

function buildModalHtml(eventData) {
  const whenWhere = [eventData.startsAt, eventData.place].filter(Boolean).join(" · ");
  return `
    <div class="local-event-modal-backdrop" data-local-event-close="true"></div>
    <section class="local-event-modal-card" role="dialog" aria-modal="true" aria-labelledby="localEventModalTitle">
      <header class="local-event-modal-header">
        <div>
          <p class="local-event-kicker">Lokalt event</p>
          <h2 id="localEventModalTitle">${escapeHtml(eventData.title)}</h2>
        </div>
        <button class="local-event-icon-btn" type="button" data-local-event-close="true" aria-label="Luk">x</button>
      </header>

      <div class="local-event-modal-body">
        ${whenWhere ? `<p class="local-event-meta">${escapeHtml(whenWhere)}</p>` : ""}
        ${eventData.summary ? `<p class="local-event-copy">${escapeHtml(eventData.summary)}</p>` : ""}

        <div class="local-event-attendance" data-local-event-attendance>
          <p class="local-event-question">Deltager du?</p>
          <div class="local-event-actions">
            <button class="local-event-primary" type="button" data-local-event-answer="yes">Ja</button>
            <button class="local-event-secondary" type="button" data-local-event-answer="no">Nej</button>
          </div>
        </div>

        <form class="local-event-competition" data-local-event-form hidden>
          <div class="local-event-prize">
            <strong>Vind en pizza hos ${escapeHtml(eventData.restaurantName)}.</strong>
            <span>Hvem vil du dele pizzaen med?</span>
          </div>

          <label>
            Dit navn
            <input name="userName" type="text" autocomplete="name" required>
          </label>

          <label>
            Telefon eller email
            <input name="contact" type="text" autocomplete="email" required>
          </label>

          <label>
            Hvem vil du dele med?
            <textarea name="shareWithText" rows="3" required></textarea>
          </label>

          <label class="local-event-checkbox">
            <input name="termsAccepted" type="checkbox" required>
            <span>Jeg accepterer konkurrencevilkår</span>
          </label>

          <p class="local-event-privacy">
            Kontaktdata bruges kun til konkurrencen, medmindre du giver særskilt samtykke andetsteds.
          </p>

          <div class="local-event-actions">
            <button class="local-event-primary" type="submit">Deltag i konkurrencen</button>
            <button class="local-event-secondary" type="button" data-local-event-close="true">Luk</button>
          </div>
        </form>

        <div class="local-event-status" data-local-event-status aria-live="polite"></div>
      </div>
    </section>
  `;
}

async function saveLocalEventResponse(eventData, response) {
  const payload = {
    noteId: eventData.noteId || null,
    eventId: eventData.eventId || null,
    restaurantId: eventData.restaurantId || eventData.companyId || null,
    companyId: eventData.companyId || eventData.restaurantId || null,
    locationId: eventData.locationId || null,
    userName: cleanText(response.userName, 160),
    contact: cleanText(response.contact, 220),
    attending: response.attending === true,
    shareWithText: cleanText(response.shareWithText, 500),
    competitionOptIn: response.competitionOptIn === true,
    responseType: cleanText(response.responseType || "attendance", 80),
    sourceModule: eventData.sourceModule || "local-events",
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, RESPONSE_COLLECTION), payload);
  return { id: docRef.id, ...payload };
}

async function saveClickOnce(eventData) {
  const key = getClickKey(eventData);
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, new Date().toISOString());
  } catch (_error) {
    // Continue without local click dedupe if storage is unavailable.
  }

  try {
    await saveLocalEventResponse(eventData, {
      attending: false,
      competitionOptIn: false,
      responseType: "click"
    });
  } catch (error) {
    console.warn("[local event] click save failed", error);
    try {
      localStorage.removeItem(key);
    } catch (_storageError) {
      // Ignore.
    }
  }
}

function showStatus(modal, message, type = "info") {
  const status = modal.querySelector("[data-local-event-status]");
  if (!status) return;
  status.textContent = message;
  status.dataset.status = type;
}

function closeModal(modal, eventData) {
  markDismissed(eventData);
  modal.remove();
}

export function openLocalEventModal(input = {}) {
  const eventData = normalizeEventData(input);
  const existing = document.querySelector(".local-event-modal");
  existing?.remove();

  const modal = document.createElement("div");
  modal.className = "local-event-modal";
  modal.innerHTML = buildModalHtml(eventData);
  document.body.appendChild(modal);
  saveClickOnce(eventData);

  modal.querySelectorAll("[data-local-event-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(modal, eventData));
  });

  modal.querySelector('[data-local-event-answer="no"]')?.addEventListener("click", async () => {
    try {
      showStatus(modal, "Gemmer svar...", "info");
      await saveLocalEventResponse(eventData, {
        attending: false,
        competitionOptIn: false
      });
      showStatus(modal, "Tak for svaret.", "success");
      setTimeout(() => closeModal(modal, eventData), 900);
    } catch (error) {
      console.error("[local event] save no response failed", error);
      showStatus(modal, "Svaret kunne ikke gemmes. Prøv igen.", "error");
    }
  });

  modal.querySelector('[data-local-event-answer="yes"]')?.addEventListener("click", () => {
    modal.querySelector("[data-local-event-form]")?.removeAttribute("hidden");
    modal.querySelector("[data-local-event-attendance]")?.setAttribute("hidden", "");
  });

  modal.querySelector("[data-local-event-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const termsAccepted = asBool(formData.get("termsAccepted")) || form.querySelector('[name="termsAccepted"]')?.checked;

    if (!termsAccepted) {
      showStatus(modal, "Du skal acceptere konkurrencevilkår for at deltage.", "error");
      return;
    }

    try {
      showStatus(modal, "Gemmer deltagelse...", "info");
      await saveLocalEventResponse(eventData, {
        userName: formData.get("userName"),
        contact: formData.get("contact"),
        attending: true,
        shareWithText: formData.get("shareWithText"),
        competitionOptIn: true
      });
      showStatus(modal, "Tak. Du er med i konkurrencen.", "success");
      form.reset();
      setTimeout(() => closeModal(modal, eventData), 1100);
    } catch (error) {
      console.error("[local event] save competition response failed", error);
      showStatus(modal, "Deltagelsen kunne ikke gemmes. Prøv igen.", "error");
    }
  });

  modal.querySelector("button, input, textarea")?.focus();
  return modal;
}

export function hasDismissedLocalEvent(input = {}) {
  return isDismissed(normalizeEventData(input));
}

window.MKP = window.MKP || {};
window.MKP.LocalEvents = {
  ...(window.MKP.LocalEvents || {}),
  openModal: openLocalEventModal,
  hasDismissed: hasDismissedLocalEvent
};

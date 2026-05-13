/**
 * cooling-overlay.js – v3
 * Draggable, collapsible panel supporting MULTIPLE simultaneous cooling runs.
 * Storage: localStorage "mk_active_cooling_runs" (array).
 * Legacy single-run key ("mk_active_cooling_run") is migrated automatically.
 *
 * Color phases over 4 hours:
 *   0–1h  → Green    1–2h → Yellow    2–3h → Blue    3–4h → Red    4h+ → Dark red (pulse)
 */

import app from "/core/firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDoc, onSnapshot, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const LS_KEY        = "mk_active_cooling_runs";   // array
const LS_KEY_LEGACY = "mk_active_cooling_run";    // old single-run key
const PANEL_ID      = "mk-cooling-panel";
const LIMIT_MS      = 4 * 60 * 60 * 1000;

const PHASES = [
    { upTo: 1 * 3600000, label: "I gang",           bg: "#0d3d1a", accent: "#2e9e4a", timerColor: "#a8f0b8", barColor: "#2e9e4a", icon: "/images/lexi_icons/cooling-happy-green.svg"   },
    { upTo: 2 * 3600000, label: "Tag temp nu",       bg: "#3d2d00", accent: "#d4a017", timerColor: "#ffe08a", barColor: "#d4a017", icon: "/images/lexi_icons/cooling-neutral-yellow.svg" },
    { upTo: 3 * 3600000, label: "Naermer sig gr.",   bg: "#0a1f3d", accent: "#1565c0", timerColor: "#90caf9", barColor: "#1565c0", icon: "/images/lexi_icons/cooling-stressed-blue.svg"  },
    { upTo: LIMIT_MS,    label: "Kritisk!",           bg: "#3d0000", accent: "#c62828", timerColor: "#ff8a80", barColor: "#c62828", icon: "/images/lexi_icons/cooling-critical-red.svg"   },
    { upTo: Infinity,    label: "OVERSKREDET",        bg: "#6d0000", accent: "#ff1a1a", timerColor: "#fff",    barColor: "#ff1a1a", icon: "/images/lexi_icons/cooling-critical-red.svg"   }
];

// ── State ──────────────────────────────────────────────────────────────────────
let timerInterval  = null;
let expandedRunIds = new Set();   // which cards are expanded
let remindersShown = new Set();   // e.g. "runId:h1"
let isPanelMin     = false;       // whole panel is minimized to pills
let firestoreUnsub = null;        // unsubscribe fn for Firestore onSnapshot

// ── Helpers ────────────────────────────────────────────────────────────────────
function esc(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatElapsed(ms) {
    const s   = Math.floor(Math.max(ms, 0) / 1000);
    const h   = Math.floor(s / 3600);
    const m   = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}t ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
    return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function getElapsedMs(startedAt) { return Date.now() - new Date(startedAt).getTime(); }

function getPhase(ms) {
    for (let i = 0; i < PHASES.length; i++) {
        if (ms < PHASES[i].upTo) return { ...PHASES[i], index: i };
    }
    return { ...PHASES[PHASES.length - 1], index: PHASES.length - 1 };
}

function getCoolingMethodLabel(m) {
    return ({
        small_containers: "Sma beholdere", fridge: "Koleskab", ice_bath: "Isbad",
        cold_running_water: "Rindende koldt vand", blast_chiller: "Blast chiller",
        stirring: "Omroring", other: "Andet"
    })[m] || m || "Ukendt";
}

// ── Storage ────────────────────────────────────────────────────────────────────
function loadRuns() {
    // Migrate legacy single-run key
    try {
        const legacyRaw = localStorage.getItem(LS_KEY_LEGACY);
        if (legacyRaw) {
            const lr = JSON.parse(legacyRaw);
            if (lr?.startedAt) {
                const existing = loadRunsRaw();
                if (!existing.find(r => r.runId === lr.runId)) saveRunsRaw([...existing, lr]);
            }
            localStorage.removeItem(LS_KEY_LEGACY);
        }
    } catch (_) {}
    return loadRunsRaw();
}

function loadRunsRaw() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch (_) { return []; }
}

function saveRunsRaw(runs) { localStorage.setItem(LS_KEY, JSON.stringify(runs)); }

function upsertRun(run) {
    const runs = loadRunsRaw();
    const idx  = runs.findIndex(r => r.runId === run.runId);
    if (idx >= 0) runs[idx] = run; else runs.push(run);
    saveRunsRaw(runs);
    // Sync to Firestore for cross-device visibility
    writeRunToFirestore(run);
}

async function writeRunToFirestore(run) {
    try {
        const db = getFirestore(app);
        await setDoc(doc(db, "activeCoolingRuns", run.runId), {
            ...run,
            // Write both companyId and organizationId so security rules match regardless of profile field name
            organizationId: run.companyId,
            _syncedAt: serverTimestamp()
        });
        console.log("[cooling] Firestore write OK:", run.runId, "companyId:", run.companyId, "locationId:", run.locationId);
    } catch (e) {
        console.error("[cooling] Firestore write FAILED:", e.code, e.message);
    }
}

function deleteRun(runId) {
    saveRunsRaw(loadRunsRaw().filter(r => r.runId !== runId));
    deleteRunFromFirestore(runId);
}

async function deleteRunFromFirestore(runId) {
    try {
        const db = getFirestore(app);
        await deleteDoc(doc(db, "activeCoolingRuns", runId));
    } catch (e) {
        console.warn("[cooling] Firestore delete failed:", e);
    }
}

// ── Drag & position ────────────────────────────────────────────────────────────
function getSavedPos() {
    try { return JSON.parse(sessionStorage.getItem("mk_panel_pos") || "null"); }
    catch (_) { return null; }
}
function savePos(x, y) { sessionStorage.setItem("mk_panel_pos", JSON.stringify({ x, y })); }

function applyPos(panel, x, y) {
    const w   = panel.offsetWidth  || 300;
    const h   = panel.offsetHeight || 200;
    const cx  = Math.max(8, Math.min(x, window.innerWidth  - w - 8));
    const cy  = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    panel.style.right  = "auto";
    panel.style.bottom = "auto";
    panel.style.left   = cx + "px";
    panel.style.top    = cy + "px";
}

function makeDraggable(panel, handle) {
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;

    function getOrigin() {
        return {
            x: parseInt(panel.style.left) || (window.innerWidth  - panel.offsetWidth  - 20),
            y: parseInt(panel.style.top)  || (window.innerHeight - panel.offsetHeight - 20)
        };
    }
    function onStart(cx, cy) {
        dragging = true;
        sx = cx; sy = cy;
        const o = getOrigin(); ox = o.x; oy = o.y;
        panel.style.right = "auto"; panel.style.bottom = "auto";
        panel.style.left  = ox + "px"; panel.style.top = oy + "px";
        panel.style.userSelect = "none";
        handle.style.cursor    = "grabbing";
    }
    function onMove(cx, cy) {
        if (!dragging) return;
        applyPos(panel, ox + (cx - sx), oy + (cy - sy));
    }
    function onEnd() {
        if (!dragging) return;
        dragging = false;
        panel.style.userSelect = "";
        handle.style.cursor    = "grab";
        savePos(parseInt(panel.style.left), parseInt(panel.style.top));
    }

    handle.addEventListener("mousedown",  e => { if (e.button === 0) { e.preventDefault(); onStart(e.clientX, e.clientY); } });
    document.addEventListener("mousemove", e => onMove(e.clientX, e.clientY));
    document.addEventListener("mouseup",   () => onEnd());
    handle.addEventListener("touchstart",  e => { const t = e.touches[0]; onStart(t.clientX, t.clientY); }, { passive: true });
    document.addEventListener("touchmove",  e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
    document.addEventListener("touchend",   () => onEnd(), { passive: true });
}

// ── Card HTML (one per run) ────────────────────────────────────────────────────
function buildCardHTML(run) {
    const elapsed   = getElapsedMs(run.startedAt);
    const phase     = getPhase(elapsed);
    const pct       = Math.min(100, (elapsed / LIMIT_MS) * 100).toFixed(1);
    const remaining = Math.max(0, LIMIT_MS - elapsed);
    const subText   = phase.index >= 4
        ? "\u274c " + formatElapsed(elapsed - LIMIT_MS) + " over graensen!"
        : formatElapsed(remaining) + " tilbage";
    const expanded  = expandedRunIds.has(run.runId);
    const rid       = run.runId;

    return `
    <div class="mk-cr" data-run-id="${esc(rid)}" style="
        border-left: 4px solid ${phase.accent};
        background: rgba(0,0,0,0.28);
        border-radius: 10px;
        margin-bottom: 6px;
        overflow: hidden;
        transition: border-color 0.8s;
    ">
        <!-- Compact row — click to toggle expand -->
        <div class="mk-cr-row" data-run-id="${esc(rid)}" style="
            display:flex;align-items:center;gap:8px;padding:9px 10px;cursor:pointer;user-select:none;
        ">
            <img class="mk-phase-icon" src="${phase.icon}" alt="${esc(phase.label)}" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;transition:opacity 0.4s;" />
            <div style="flex:1;min-width:0;overflow:hidden;">
                <div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(run.productName || "Ukendt produkt")}</div>
                <div class="mk-phase-lbl" style="font-size:10px;color:rgba(255,255,255,0.45);">${esc(phase.label)}</div>
            </div>
            <div id="mk-cr-timer-${esc(rid)}" style="font-size:12px;font-weight:800;font-variant-numeric:tabular-nums;color:${phase.timerColor};white-space:nowrap;flex-shrink:0;transition:color 0.8s;">${formatElapsed(elapsed)}</div>
            <button class="mk-cr-toggle" data-run-id="${esc(rid)}" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:13px;cursor:pointer;padding:0 2px;line-height:1;flex-shrink:0;">${expanded ? "\u25b2" : "\u25bc"}</button>
        </div>

        <!-- Expanded details -->
        <div class="mk-cr-detail" data-run-id="${esc(rid)}" style="display:${expanded ? "block" : "none"};padding:0 10px 12px;">
            <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:10px;">
                ${esc(getCoolingMethodLabel(run.coolingMethod))} \u00b7 Start: ${esc(String(run.startTemp))}\u00b0C
            </div>

            <!-- Big timer -->
            <div style="text-align:center;margin-bottom:6px;">
                <img id="mk-cr-bigicon-${esc(rid)}" src="${phase.icon}" alt="${esc(phase.label)}" style="width:56px;height:56px;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto;transition:opacity 0.4s;" />
                <div id="mk-cr-bigtimer-${esc(rid)}" style="font-size:30px;font-weight:900;font-variant-numeric:tabular-nums;letter-spacing:-0.02em;color:${phase.timerColor};transition:color 0.8s;line-height:1;">${formatElapsed(elapsed)}</div>
                <div id="mk-cr-sub-${esc(rid)}" style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:4px;">${subText}</div>
            </div>

            <!-- Progress bar -->
            <div style="height:7px;background:rgba(255,255,255,0.1);border-radius:99px;overflow:hidden;margin-bottom:3px;">
                <div id="mk-cr-bar-${esc(rid)}" style="height:100%;width:${pct}%;background:${phase.barColor};border-radius:99px;transition:width 1s linear,background 0.8s;"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:9px;color:rgba(255,255,255,0.25);margin-bottom:10px;padding:0 2px;">
                <span>0t</span><span>1t</span><span>2t</span><span>3t</span><span>4t</span>
            </div>

            <!-- Measurement reminder (hidden by default) -->
            <div id="mk-cr-reminder-${esc(rid)}" style="display:none;background:rgba(255,255,255,0.08);border-radius:8px;padding:7px 10px;font-size:11px;font-weight:700;margin-bottom:10px;text-align:center;">
                \u23f0 Tag temperaturm\u00e5ling nu!
            </div>

            <!-- Inputs -->
            <label style="font-size:10px;color:rgba(255,255,255,0.45);display:block;margin-bottom:3px;">Sluttemperatur (\u00b0C) <span style="color:#ff8a80;">*</span></label>
            <input id="mk-cr-endtemp-${esc(rid)}" type="number" step="0.5" inputmode="decimal" placeholder="fx 8" style="width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.3);color:#fff;font-size:15px;outline:none;margin-bottom:8px;" />
            <label style="font-size:10px;color:rgba(255,255,255,0.45);display:block;margin-bottom:3px;">Bem\u00e6rkning (valgfri)</label>
            <input id="mk-cr-note-${esc(rid)}" type="text" placeholder="Tilf\u00f8j kommentar" style="width:100%;box-sizing:border-box;padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.3);color:#fff;font-size:12px;outline:none;margin-bottom:10px;" />

            <!-- Action buttons -->
            <div style="display:flex;gap:6px;">
                <button class="mk-cr-finish" data-run-id="${esc(rid)}" id="mk-cr-finishbtn-${esc(rid)}" style="flex:1;padding:10px;background:${phase.accent};color:#fff;border:none;border-radius:9px;font-size:13px;font-weight:800;cursor:pointer;transition:background 0.8s;">\u2705 Afslut</button>
                <button class="mk-cr-abort"  data-run-id="${esc(rid)}" title="Afbryd" style="padding:10px 12px;background:rgba(200,0,0,0.15);color:#ff8a80;border:1px solid rgba(200,0,0,0.2);border-radius:9px;font-size:14px;cursor:pointer;">\u2715</button>
            </div>
        </div>
    </div>`;
}

// ── Full panel HTML ────────────────────────────────────────────────────────────
function buildPanelHTML(runs) {
    return `
    <style id="mk-cooling-style">
        @keyframes mk-pulse3 { 0%,100%{opacity:1} 50%{opacity:.45} }
        #mk-cooling-panel .mk-cr-row:hover { background: rgba(255,255,255,0.05); border-radius: 8px; }
        @media (max-width: 600px) {
            #mk-cooling-panel {
                left: 0 !important; right: 0 !important;
                bottom: 0 !important; top: auto !important;
                width: 100% !important; max-width: 100% !important;
                border-radius: 18px 18px 0 0 !important;
                max-height: 85vh; overflow-y: auto;
            }
        }
    </style>
    <div id="${PANEL_ID}" style="
        position:fixed; bottom:20px; right:20px; z-index:99999;
        width:300px; background:#0e1c11; color:#fff;
        border-radius:16px; box-shadow:0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.06);
        font-family:'Inter',system-ui,sans-serif; overflow:hidden;
    ">
        <!-- Header / drag handle -->
        <div id="mk-panel-handle" style="
            background:#172d1b; padding:9px 12px;
            display:flex; align-items:center; justify-content:space-between;
            cursor:grab; user-select:none;
            border-bottom:1px solid rgba(255,255,255,0.06);
        ">
            <div style="display:flex;align-items:center;gap:7px;">
                <span style="font-size:14px;">\u{1F9CA}</span>
                <span style="font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#7ecf8a;">Nedк\u00f8ling</span>
                <span id="mk-panel-count" style="background:#2e9e4a;color:#fff;font-size:10px;font-weight:800;padding:1px 7px;border-radius:99px;">${runs.length}</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;">
                <button id="mk-panel-minimize" title="Minimer" style="background:rgba(255,255,255,0.1);border:none;color:#fff;width:22px;height:22px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;padding:0;">&mdash;</button>
                <a href="/modules/egenkontrol/rutiner.html" title="G\u00e5 til rutiner" style="background:rgba(255,255,255,0.1);color:#fff;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;text-decoration:none;">&#x2197;</a>
            </div>
        </div>

        <!-- Run cards -->
        <div id="mk-panel-body" style="padding:7px 7px 5px;">
            ${runs.map(r => buildCardHTML(r)).join("")}
        </div>
    </div>`;
}

// ── Minimized pill bar ─────────────────────────────────────────────────────────
function buildMinimizedHTML(runs) {
    const pills = runs.map(r => {
        const phase = getPhase(getElapsedMs(r.startedAt));
        return `<div class="mk-minpill" data-run-id="${esc(r.runId)}" title="${esc(r.productName)}" style="display:inline-flex;align-items:center;gap:6px;background:${phase.bg};border:1px solid ${phase.accent}88;color:#fff;border-radius:99px;padding:4px 10px 4px 4px;font-size:11px;font-weight:700;cursor:pointer;user-select:none;transition:background 0.8s,border-color 0.8s;">
            <img class="mk-mpill-icon" src="${phase.icon}" alt="${esc(phase.label)}" style="width:24px;height:24px;border-radius:50%;flex-shrink:0;transition:opacity 0.4s;" />
            <span style="max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc((r.productName || "").substring(0, 14))}</span>
            <span id="mk-minpill-t-${esc(r.runId)}" style="opacity:0.75;font-variant-numeric:tabular-nums;"></span>
        </div>`;
    }).join("");

    return `
    <style id="mk-cooling-style">
        @keyframes mk-pulse3 { 0%,100%{opacity:1} 50%{opacity:.45} }
    </style>
    <div id="${PANEL_ID}" style="position:fixed;bottom:14px;right:14px;z-index:99999;display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:90vw;font-family:'Inter',system-ui,sans-serif;">
        ${pills}
        <button id="mk-panel-restore" style="background:#172d1b;color:#7ecf8a;border:1px solid #2e9e4a44;border-radius:99px;padding:5px 11px;font-size:11px;font-weight:800;cursor:pointer;">\u{1F9CA} ${runs.length > 1 ? runs.length + " k\u00f8rende" : "Vis"}</button>
    </div>`;
}

// ── Timer tick (updates all cards) ────────────────────────────────────────────
function startPanelTimer() {
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) { clearInterval(timerInterval); return; }

        loadRunsRaw().forEach(run => {
            const rid     = run.runId;
            const elapsed = getElapsedMs(run.startedAt);
            const phase   = getPhase(elapsed);
            const pct     = Math.min(100, (elapsed / LIMIT_MS) * 100).toFixed(1);
            const rem     = Math.max(0, LIMIT_MS - elapsed);
            const subTxt  = phase.index >= 4
                ? "\u274c " + formatElapsed(elapsed - LIMIT_MS) + " over graensen!"
                : formatElapsed(rem) + " tilbage";

            // Compact row timer
            const miniT = document.getElementById(`mk-cr-timer-${rid}`);
            if (miniT) { miniT.textContent = formatElapsed(elapsed); miniT.style.color = phase.timerColor; }

            // Minimized pill timer
            const pillT = document.getElementById(`mk-minpill-t-${rid}`);
            if (pillT) pillT.textContent = formatElapsed(elapsed);

            // Big timer
            const bigT = document.getElementById(`mk-cr-bigtimer-${rid}`);
            if (bigT) { bigT.textContent = formatElapsed(elapsed); bigT.style.color = phase.timerColor; }

            // Sub label
            const sub = document.getElementById(`mk-cr-sub-${rid}`);
            if (sub) sub.textContent = subTxt;

            // Progress bar
            const bar = document.getElementById(`mk-cr-bar-${rid}`);
            if (bar) { bar.style.width = `${pct}%`; bar.style.background = phase.barColor; }

            // Card border + phase icon + phase label + finish button color
            const card = panel.querySelector(`.mk-cr[data-run-id="${rid}"]`);
            if (card) {
                card.style.borderLeftColor = phase.accent;
                card.style.animation = phase.index >= 4 ? "mk-pulse3 1s ease-in-out infinite" : "";
                const rowIcon = card.querySelector(".mk-phase-icon");
                if (rowIcon && rowIcon.src !== phase.icon) rowIcon.src = phase.icon;
                const bigIcon = document.getElementById(`mk-cr-bigicon-${rid}`);
                if (bigIcon && bigIcon.src !== phase.icon) bigIcon.src = phase.icon;
                const lbl = card.querySelector(".mk-phase-lbl");
                if (lbl) lbl.textContent = phase.label;
                const finBtn = document.getElementById(`mk-cr-finishbtn-${rid}`);
                if (finBtn) finBtn.style.background = phase.accent;
            }

            // Minimized pill
            const pill = panel.querySelector(`.mk-minpill[data-run-id="${rid}"]`);
            if (pill) {
                pill.style.background  = phase.bg;
                pill.style.borderColor = phase.accent + "88";
                pill.style.animation   = phase.index >= 4 ? "mk-pulse3 1s ease-in-out infinite" : "";
                const pillIcon = pill.querySelector(".mk-mpill-icon");
                if (pillIcon && pillIcon.src !== phase.icon) pillIcon.src = phase.icon;
            }

            // Reminders at 1h/2h/3h (show for first 5 minutes of each hour)
            const hoursPassed = Math.floor(elapsed / 3600000);
            const minInHour   = Math.floor((elapsed % 3600000) / 60000);
            const reminderEl  = document.getElementById(`mk-cr-reminder-${rid}`);
            if (reminderEl) {
                const key = `${rid}:h${hoursPassed}`;
                if (hoursPassed >= 1 && hoursPassed < 4 && minInHour < 5) remindersShown.add(key);
                reminderEl.style.display = remindersShown.has(key) && minInHour < 5 ? "block" : "none";
            }
        });
    }, 1000);
}

// ── Render / re-render panel ───────────────────────────────────────────────────
function renderPanel() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    document.getElementById(PANEL_ID)?.remove();
    document.getElementById("mk-cooling-style")?.remove();

    const runs = loadRunsRaw();
    if (!runs.length) return;

    if (isPanelMin) {
        document.body.insertAdjacentHTML("beforeend", buildMinimizedHTML(runs));
        startPanelTimer();

        document.getElementById("mk-panel-restore")?.addEventListener("click", () => {
            isPanelMin = false;
            renderPanel();
        });
        document.querySelectorAll(".mk-minpill").forEach(pill => {
            pill.addEventListener("click", () => {
                isPanelMin = false;
                expandedRunIds.add(pill.dataset.runId);
                renderPanel();
            });
        });
        return;
    }

    // Auto-expand: single run always expanded; multiple runs only expand first if nothing open
    if (runs.length === 1) expandedRunIds.add(runs[0].runId);
    else if (expandedRunIds.size === 0) expandedRunIds.add(runs[0].runId);

    document.body.insertAdjacentHTML("beforeend", buildPanelHTML(runs));
    startPanelTimer();

    // Position + draggable
    const panel  = document.getElementById(PANEL_ID);
    const handle = document.getElementById("mk-panel-handle");
    if (panel && handle) {
        const pos = getSavedPos();
        if (pos) applyPos(panel, pos.x, pos.y);
        makeDraggable(panel, handle);
    }

    // Minimize
    document.getElementById("mk-panel-minimize")?.addEventListener("click", () => {
        isPanelMin = true;
        renderPanel();
    });

    // Delegated clicks
    panel?.addEventListener("click", e => {
        // Toggle expand via row click or arrow button
        const toggle = e.target.closest(".mk-cr-toggle");
        const row    = e.target.closest(".mk-cr-row");
        if (toggle || (row && !e.target.closest(".mk-cr-detail"))) {
            const rid = (toggle || row).dataset.runId;
            if (!rid) return;
            if (expandedRunIds.has(rid)) expandedRunIds.delete(rid);
            else expandedRunIds.add(rid);
            const body = document.getElementById("mk-panel-body");
            if (body) body.innerHTML = loadRunsRaw().map(r => buildCardHTML(r)).join("");
            return;
        }

        // Finish run
        const finBtn = e.target.closest(".mk-cr-finish");
        if (finBtn) { handleFinish(finBtn.dataset.runId); return; }

        // Abort run
        const abortBtn = e.target.closest(".mk-cr-abort");
        if (abortBtn) { handleAbort(abortBtn.dataset.runId); }
    });
}

// ── Finish run (save to Firestore) ────────────────────────────────────────────
async function finishRun(runData, endTemp, note) {
    const finishedAt      = new Date();
    const finishedAtIso   = finishedAt.toISOString();
    const coolingDuration = Math.round((finishedAt - new Date(runData.startedAt)) / 60000);
    const startTemp       = Number(runData.startTemp);
    const methodLabel     = getCoolingMethodLabel(runData.coolingMethod);
    const passed          = startTemp >= 65 && endTemp <= 10 && coolingDuration <= 240;

    let failureReason = null;
    if (!passed) {
        const r = [];
        if (startTemp < 65)        r.push(`Starttemperatur ${startTemp}\u00b0C er under kravet p\u00e5 65\u00b0C`);
        if (endTemp > 10)          r.push(`Sluttemperatur ${endTemp}\u00b0C er over kravet p\u00e5 10\u00b0C`);
        if (coolingDuration > 240) r.push(`Nedk\u00f8lingstid ${coolingDuration} min overskred 4-timers gr\u00e6nse (240 min)`);
        failureReason = r.join(". ");
    }

    const noteText = note || (passed
        ? `Kontrol udf\u00f8rt. Nedk\u00f8lingen overholder gr\u00e6nsev\u00e6rdierne (under 4 timer). Metode: ${methodLabel}.`
        : `Nedk\u00f8ling fejlet. Metode: ${methodLabel}. ${failureReason}`);

    const entryData = {
        entryType: "cooling_control",
        measurementValue: endTemp,
        coolingData: {
            runId: runData.runId,
            productName: runData.productName,
            quantityBucket: runData.quantityBucket,
            coolingMethod: runData.coolingMethod,
            coolingMethodLabel: methodLabel,
            startTemp, endTemp, coolingDuration,
            startedAt: runData.startedAt,
            finishedAt: finishedAtIso
        },
        evaluation: { passed, failureReason, startTemp, endTemp, durationMinutes: coolingDuration },
        note: noteText,
        actionType: "cooling_run_finish",
        status: passed ? "completed" : "deviation",
        resultStatus: passed ? "completed" : "deviation"
    };

    if (!passed) {
        entryData.requiresDeviation = true;
        entryData.deviationData = {
            templateKey: "nedkoeling",
            productName: runData.productName,
            quantityBucket: runData.quantityBucket,
            coolingMethod: runData.coolingMethod,
            coolingMethodLabel: methodLabel,
            startTemp,
            endTemp,
            durationMinutes: coolingDuration,
            startedAt: runData.startedAt,
            finishedAt: finishedAtIso,
            failureReason,
            correctiveActionRequired: true
        };
    }

    const result = {
        entryStatus: passed ? "completed" : "deviation",
        instanceStatus: passed ? "completed" : "deviation",
        shouldCreateDeviation: !passed,
        deviationType: passed ? null : "cooling_failure",
        deviationTitle: passed ? null : `Nedk\u00f8ling fejlet: ${runData.productName}`,
        deviationDescription: passed ? null : `Nedk\u00f8ling af ${runData.productName} overholder ikke 4-timers reglen. ${failureReason}`,
        documented: passed
    };

    const functions = getFunctions(app, "us-central1");
    await httpsCallable(functions, "saveRoutineTask")({
        companyId: runData.companyId,
        locationId: runData.locationId,
        unitId: runData.unitId || "",
        taskInstanceId: runData.instanceId,
        taskId: runData.taskId || "",
        taskDateKey: runData.dateKey,
        actionType: "cooling_run_finish",
        completedBy: runData.completedBy || "",
        completedByName: runData.completedByName || "",
        deadlineAt: runData.deadlineAt || "",
        completedLate: false,
        overdueLogged: false,
        entryData,
        result
    });

    return { passed, coolingDuration, endTemp };
}

// ── Handle finish click ────────────────────────────────────────────────────────
async function handleFinish(runId) {
    const runData = loadRunsRaw().find(r => r.runId === runId);
    if (!runData) return;

    const endTempInput = document.getElementById(`mk-cr-endtemp-${runId}`);
    const noteInput    = document.getElementById(`mk-cr-note-${runId}`);
    const endTemp      = parseFloat(endTempInput?.value ?? "");
    const note         = (noteInput?.value ?? "").trim();

    if (isNaN(endTemp)) {
        if (endTempInput) { endTempInput.focus(); endTempInput.style.borderColor = "#f08080"; }
        return;
    }

    const finBtn = document.getElementById(`mk-cr-finishbtn-${runId}`);
    if (finBtn) { finBtn.disabled = true; finBtn.textContent = "Gemmer..."; }

    try {
        const { passed, coolingDuration, endTemp: finalTemp } = await finishRun(runData, endTemp, note);
        deleteRun(runId);
        expandedRunIds.delete(runId);

        const card = document.querySelector(`.mk-cr[data-run-id="${runId}"]`);
        if (card) {
            card.style.borderLeftColor = passed ? "#2e9e4a" : "#c62828";
            card.innerHTML = `
                <div style="padding:12px 14px;text-align:center;">
                    <span style="font-size:22px;">${passed ? "\u2705" : "\u274c"}</span>
                    <span style="font-size:13px;font-weight:700;margin-left:8px;color:#fff;">${passed ? "Godkendt!" : "Ikke godkendt"}</span>
                    <div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:4px;">${coolingDuration} min \u00b7 ${finalTemp}\u00b0C${!passed ? " \u00b7 Afvigelse oprettet" : ""}</div>
                </div>`;
            setTimeout(() => {
                card.remove();
                const rem     = loadRunsRaw();
                const countEl = document.getElementById("mk-panel-count");
                if (countEl) countEl.textContent = rem.length;
                if (!rem.length) {
                    clearInterval(timerInterval);
                    document.getElementById(PANEL_ID)?.remove();
                    document.getElementById("mk-cooling-style")?.remove();
                }
            }, 3000);
        }

        if (window.__mkCoolingRunFinished) window.__mkCoolingRunFinished(runData.instanceId);
    } catch (err) {
        console.error("[cooling] finishRun error:", err);
        if (finBtn) { finBtn.disabled = false; finBtn.textContent = "\u2705 Afslut"; }
        alert(err?.message || "Kunne ikke gemme nedk\u00f8lingen. Pr\u00f8v igen.");
    }
}

// ── Handle abort click ────────────────────────────────────────────────────────
async function handleAbort(runId) {
    if (!confirm("Afbryd denne nedk\u00f8ling? Forløbet registreres som en afvigelse.")) return;
    const runData = loadRunsRaw().find(r => r.runId === runId);
    if (!runData) return;

    const noteInput = document.getElementById(`mk-cr-note-${runId}`);
    const note = (noteInput?.value ?? "").trim();
    const abortedAt = new Date();
    const coolingDuration = runData.startedAt
        ? Math.max(0, Math.round((abortedAt - new Date(runData.startedAt)) / 60000))
        : 0;
    const methodLabel = getCoolingMethodLabel(runData.coolingMethod);
    const noteText = note || `Nedkøling afbrudt efter ${coolingDuration} min. Metode: ${methodLabel}.`;

    const entryData = {
        entryType: "cooling_control",
        coolingData: {
            runId: runData.runId,
            productName: runData.productName,
            quantityBucket: runData.quantityBucket,
            coolingMethod: runData.coolingMethod,
            coolingMethodLabel: methodLabel,
            startTemp: Number(runData.startTemp),
            endTemp: null,
            coolingDuration,
            startedAt: runData.startedAt,
            finishedAt: abortedAt.toISOString(),
            aborted: true
        },
        evaluation: {
            passed: false,
            aborted: true,
            failureReason: "Nedkølingen blev afbrudt før afslutning",
            startTemp: Number(runData.startTemp),
            endTemp: null,
            durationMinutes: coolingDuration
        },
        note: noteText,
        actionType: "aborted",
        status: "failed",
        hasDeviation: true,
        requiresAlert: true,
        alertData: {
            alertType: "cooling_failure",
            severity: "high",
            title: `Nedkøling afbrudt: ${runData.productName}`,
            description: noteText,
            productName: runData.productName,
            quantityBucket: runData.quantityBucket,
            coolingMethod: runData.coolingMethod,
            coolingMethodLabel: methodLabel,
            startTemp: Number(runData.startTemp),
            endTemp: null,
            coolingDuration,
            aborted: true
        }
    };

    const result = {
        entryStatus: "failed",
        instanceStatus: "failed",
        shouldCreateAlert: true,
        alertType: "cooling_failure",
        alertTitle: `Nedkøling afbrudt: ${runData.productName}`,
        alertDescription: noteText
    };

    try {
        const functions = getFunctions(app, "us-central1");
        await httpsCallable(functions, "saveRoutineTask")({
            companyId: runData.companyId,
            locationId: runData.locationId,
            unitId: runData.unitId || "",
            taskInstanceId: runData.instanceId,
            taskId: runData.taskId || "",
            taskDateKey: runData.dateKey,
            actionType: "cooling_run_abort",
            completedBy: runData.completedBy || "",
            completedByName: runData.completedByName || "",
            deadlineAt: runData.deadlineAt || "",
            completedLate: false,
            overdueLogged: false,
            entryData,
            result
        });

        deleteRun(runId);
        expandedRunIds.delete(runId);
        const remaining = loadRunsRaw();
        if (!remaining.length) {
            clearInterval(timerInterval);
            document.getElementById(PANEL_ID)?.remove();
            document.getElementById("mk-cooling-style")?.remove();
        } else {
            renderPanel();
        }

        if (window.__mkCoolingRunFinished) window.__mkCoolingRunFinished(runData.instanceId);
    } catch (err) {
        console.error("[cooling] abort error:", err);
        alert(err?.message || "Kunne ikke afbryde nedkølingen korrekt. Prøv igen.");
    }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/** Start tracking a new cooling run and show / update the panel. */
export function startCoolingRun(runData) {
    upsertRun(runData);
    expandedRunIds.add(runData.runId);
    isPanelMin = false;
    renderPanel();
}

/** Patch stored run data (e.g. after SETTINGS resolve). */
export function updateCoolingRunData(patch) {
    if (!patch?.runId) return;
    const runs = loadRunsRaw();
    const idx  = runs.findIndex(r => r.runId === patch.runId);
    if (idx >= 0) { runs[idx] = { ...runs[idx], ...patch }; saveRunsRaw(runs); }
}

/** Returns the first active run (backward-compat). */
export function getActiveCoolingRun() {
    return loadRunsRaw()[0] || null;
}

/** Returns all active cooling runs. */
export function getActiveCoolingRuns() {
    return loadRunsRaw();
}

/** Call once from layout.js on every page load. */
export function initCoolingOverlay() {
    // 1. Render from localStorage immediately (fast, works offline)
    const runs = loadRuns();   // also migrates legacy single-run key
    const fresh = runs.filter(r => getElapsedMs(r.startedAt) < 6 * 3600000);
    if (fresh.length !== runs.length) saveRunsRaw(fresh);
    if (fresh.length) renderPanel();

    // 2. Set up real-time Firestore sync for cross-device support
    const auth = getAuth(app);
    onAuthStateChanged(auth, async (user) => {
        if (firestoreUnsub) { firestoreUnsub(); firestoreUnsub = null; }
        if (!user) return;

        try {
            const db = getFirestore(app);
            const profileSnap = await getDoc(doc(db, "users", user.uid));
            if (!profileSnap.exists()) return;
            const profile    = profileSnap.data();
            const companyId  = profile.companyId || profile.organizationId;
            const locationId = profile.primaryLocationId
                || (Array.isArray(profile.locationIds) ? profile.locationIds[0] : null)
                || profile.locationId;
            if (!companyId || !locationId) {
                console.warn("[cooling] sync skipped — missing companyId or locationId", { companyId, locationId });
                return;
            }

            console.log("[cooling] Setting up sync — companyId:", companyId, "locationId:", locationId);

            const q = query(
                collection(db, "activeCoolingRuns"),
                where("companyId",  "==", companyId),
                where("locationId", "==", locationId)
            );

            firestoreUnsub = onSnapshot(q, (snapshot) => {
                const fsRuns  = snapshot.docs.map(d => d.data());
                const fsRaw   = fsRuns.filter(r => r?.startedAt && getElapsedMs(r.startedAt) < 6 * 3600000);
                console.log("[cooling] onSnapshot fired — docs:", snapshot.docs.length, "valid:", fsRaw.length);

                // Merge: keep local runs that are <90s old and not yet confirmed by Firestore
                // (Firestore write may still be in-flight when first snapshot arrives)
                const fsRunIds    = new Set(fsRaw.map(r => r.runId));
                const localRuns   = loadRunsRaw();
                const recentLocal = localRuns.filter(r =>
                    r.runId && !fsRunIds.has(r.runId) &&
                    r.startedAt && getElapsedMs(r.startedAt) < 90000
                );
                const merged = [...fsRaw, ...recentLocal];
                console.log("[cooling] merged:", merged.length, "(fs:", fsRaw.length, "+ local pending:", recentLocal.length, ")");

                saveRunsRaw(merged);

                // Re-render (position is restored from sessionStorage)
                const panelExists = !!document.getElementById(PANEL_ID);
                if (merged.length > 0) {
                    renderPanel();
                } else if (panelExists) {
                    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
                    document.getElementById(PANEL_ID)?.remove();
                    document.getElementById("mk-cooling-style")?.remove();
                }
            }, err => {
                console.error("[cooling] Firestore listener FAILED:", err.code, err.message);
            });
        } catch (e) {
            console.warn("[cooling] Could not set up cross-device sync:", e);
        }
    });
}

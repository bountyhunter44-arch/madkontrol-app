/**
 * hot-holding-overlay.js – v1
 * Draggable, collapsible panel supporting MULTIPLE simultaneous hot holding runs.
 * Storage: localStorage "mk_active_hot_holding_runs" (array).
 *
 * Check interval: 60 minutes
 * Critical limit: 65°C
 * Status: ok (>= 65°C) or deviation (< 65°C)
 */

import app from "/core/firebase-config.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, getDoc, onSnapshot, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const LS_KEY        = "mk_active_hot_holding_runs";
const PANEL_ID      = "mk-hot-holding-panel";
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes

// ── State ──────────────────────────────────────────────────────────────────────
let timerInterval  = null;
let expandedRunIds = new Set();
let isPanelMin     = false;
let firestoreUnsub = null;

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

function getNextCheckLabel(nextCheckAt) {
    if (!nextCheckAt) return "Ikke planlagt";
    const diff = new Date(nextCheckAt).getTime() - Date.now();
    if (diff < 0) return "OVERSKREDET!";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `Om ${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `Om ${hours}t ${remainMins}m`;
}

// ── Storage ────────────────────────────────────────────────────────────────────
function loadRuns() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch (_) { return []; }
}

function saveRuns(runs) { localStorage.setItem(LS_KEY, JSON.stringify(runs)); }

function upsertRun(run) {
    const runs = loadRuns();
    const idx  = runs.findIndex(r => r.runId === run.runId);
    if (idx >= 0) runs[idx] = run; else runs.push(run);
    saveRuns(runs);
    writeRunToFirestore(run);
}

function removeRun(runId) {
    const runs = loadRuns().filter(r => r.runId !== runId);
    saveRuns(runs);
    deleteRunFromFirestore(runId);
}

// ── Firestore sync ─────────────────────────────────────────────────────────────
async function writeRunToFirestore(run) {
    try {
        const auth = getAuth(app);
        const user = auth.currentUser;
        if (!user) return;
        
        const db = getFirestore(app);
        const docRef = doc(db, "hot_holding_runs", run.runId);
        await setDoc(docRef, {
            ...run,
            userId: user.uid,
            updatedAt: serverTimestamp()
        });
        console.log("[hot holding] Synced to Firestore:", run.runId);
    } catch (err) {
        console.warn("[hot holding] Firestore write failed:", err);
    }
}

async function deleteRunFromFirestore(runId) {
    try {
        const db = getFirestore(app);
        await deleteDoc(doc(db, "hot_holding_runs", runId));
        console.log("[hot holding] Deleted from Firestore:", runId);
    } catch (err) {
        console.warn("[hot holding] Firestore delete failed:", err);
    }
}

function subscribeToFirestoreRuns() {
    const auth = getAuth(app);
    const user = auth.currentUser;
    if (!user) return;
    
    const db = getFirestore(app);
    const collectionName = "hot_holding_runs";
    const queryConstraints = { userId: user.uid };
    console.log('[hot holding] DEBUG subscription:', { collectionName, queryConstraints });
    
    const q = query(collection(db, collectionName), where("userId", "==", user.uid));
    
    firestoreUnsub = onSnapshot(q, (snapshot) => {
        console.log("[hot holding restore] Firestore snapshot:", snapshot.size);
        const localRuns = loadRuns();
        const localIds = new Set(localRuns.map(r => r.runId));
        
        snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (!localIds.has(data.runId)) {
                console.log("[hot holding restore] Restoring run:", data.runId);
                upsertRun(data);
            }
        });
        
        renderPanel();
    });
}

// ── Panel rendering ────────────────────────────────────────────────────────────
function renderPanel() {
    const runs = loadRuns();
    if (runs.length === 0) {
        removePanel();
        return;
    }
    
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
        panel = document.createElement("div");
        panel.id = PANEL_ID;
        panel.className = "mk-hot-holding-panel";
        document.body.appendChild(panel);
        makeDraggable(panel);
    }
    
    const html = `
        <div class="mk-hot-holding-header">
            <div class="mk-hot-holding-title">
                <span class="mk-hot-holding-icon">🔥</span>
                <span>Aktive varmholdelser (${runs.length})</span>
            </div>
            <div class="mk-hot-holding-controls">
                <button class="mk-hot-holding-btn-min" onclick="window.__toggleHotHoldingPanel()" title="Minimer/Maksimer">
                    ${isPanelMin ? '▲' : '▼'}
                </button>
            </div>
        </div>
        <div class="mk-hot-holding-body" style="display: ${isPanelMin ? 'none' : 'block'}">
            ${runs.map(renderRunCard).join('')}
        </div>
    `;
    
    panel.innerHTML = html;
}

function renderRunCard(run) {
    const elapsed = getElapsedMs(run.startedAt);
    const isExpanded = expandedRunIds.has(run.runId);
    const isOverdue = run.nextCheckAt && new Date(run.nextCheckAt).getTime() < Date.now();
    const isDeviation = run.latestTemperature !== null && run.latestTemperature !== undefined && run.latestTemperature < 65;
    
    const statusClass = isDeviation ? 'deviation' : (run.status === 'ok' ? 'ok' : 'neutral');
    const statusLabel = isDeviation ? 'AFVIGELSE - Under 65°C' : (run.status === 'ok' ? 'OK - Over 65°C' : 'Igangværende');
    
    return `
        <div class="mk-hot-holding-card ${statusClass} ${isOverdue ? 'overdue' : ''}" data-run-id="${esc(run.runId)}">
            <div class="mk-hot-holding-card-header" onclick="window.__toggleHotHoldingCard('${esc(run.runId)}')">
                <div class="mk-hot-holding-card-title">
                    <strong>${esc(run.unitName || run.unitId)}</strong>
                    <span class="mk-hot-holding-status">${statusLabel}</span>
                </div>
                <div class="mk-hot-holding-card-timer">${formatElapsed(elapsed)}</div>
            </div>
            <div class="mk-hot-holding-card-body" style="display: ${isExpanded ? 'block' : 'none'}">
                <div class="mk-hot-holding-info-grid">
                    <div class="mk-hot-holding-info-item">
                        <span class="mk-hot-holding-info-label">Startet:</span>
                        <span class="mk-hot-holding-info-value">${new Date(run.startedAt).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="mk-hot-holding-info-item">
                        <span class="mk-hot-holding-info-label">Start temp:</span>
                        <span class="mk-hot-holding-info-value">${run.startTemperature}°C</span>
                    </div>
                    <div class="mk-hot-holding-info-item">
                        <span class="mk-hot-holding-info-label">Seneste temp:</span>
                        <span class="mk-hot-holding-info-value ${run.latestTemperature < 65 ? 'temp-critical' : 'temp-ok'}">
                            ${run.latestTemperature !== null && run.latestTemperature !== undefined ? run.latestTemperature + '°C' : 'Ikke målt'}
                        </span>
                    </div>
                    <div class="mk-hot-holding-info-item">
                        <span class="mk-hot-holding-info-label">Næste kontrol:</span>
                        <span class="mk-hot-holding-info-value ${isOverdue ? 'overdue-text' : ''}">
                            ${getNextCheckLabel(run.nextCheckAt)}
                        </span>
                    </div>
                </div>
                <div class="mk-hot-holding-actions">
                    <button class="mk-hot-holding-btn-measure" onclick="window.__measureHotHoldingTemp('${esc(run.runId)}')">
                        Mål temperatur
                    </button>
                    <button class="mk-hot-holding-btn-stop" onclick="window.__stopHotHoldingRun('${esc(run.runId)}')">
                        Stop varmholdelse
                    </button>
                </div>
            </div>
        </div>
    `;
}

function removePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (panel) panel.remove();
}

// ── Draggable ──────────────────────────────────────────────────────────────────
function makeDraggable(panel) {
    let isDragging = false, offsetX = 0, offsetY = 0;
    
    const header = panel.querySelector(".mk-hot-holding-header");
    if (!header) return;
    
    header.style.cursor = "move";
    header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) return;
        isDragging = true;
        offsetX = e.clientX - panel.offsetLeft;
        offsetY = e.clientY - panel.offsetTop;
    });
    
    document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        panel.style.left = `${e.clientX - offsetX}px`;
        panel.style.top  = `${e.clientY - offsetY}px`;
    });
    
    document.addEventListener("mouseup", () => { isDragging = false; });
}

// ── Public API ─────────────────────────────────────────────────────────────────
export function startHotHoldingRun({ instanceId, unitId, unitName, startTemperature, companyId, locationId }) {
    const runId = `${instanceId}__${Date.now()}`;
    const now = new Date();
    const nextCheck = new Date(now.getTime() + CHECK_INTERVAL_MS);
    
    const run = {
        runId,
        instanceId,
        unitId,
        unitName,
        startedAt: now.toISOString(),
        startedAtLabel: now.toLocaleString('da-DK'),
        startTemperature,
        latestTemperature: startTemperature,
        latestMeasuredAt: now.toISOString(),
        nextCheckAt: nextCheck.toISOString(),
        status: startTemperature >= 65 ? 'ok' : 'deviation',
        companyId,
        locationId
    };
    
    console.log("[hot holding start]", run);
    upsertRun(run);
    renderPanel();
    startTimer();
    
    return run;
}

export function getActiveHotHoldingRun(instanceId) {
    const runs = loadRuns();
    return runs.find(r => r.instanceId === instanceId);
}

export function getActiveHotHoldingRuns() {
    return loadRuns();
}

export function updateHotHoldingTemperature(runId, temperature) {
    const runs = loadRuns();
    const run = runs.find(r => r.runId === runId);
    if (!run) return null;
    
    const now = new Date();
    const nextCheck = new Date(now.getTime() + CHECK_INTERVAL_MS);
    
    run.latestTemperature = temperature;
    run.latestMeasuredAt = now.toISOString();
    run.nextCheckAt = nextCheck.toISOString();
    run.status = temperature >= 65 ? 'ok' : 'deviation';
    
    console.log("[hot holding measurement]", { runId, temperature, status: run.status });
    upsertRun(run);
    renderPanel();
    
    return run;
}

export function stopHotHoldingRun(runId) {
    console.log("[hot holding] Stopping run:", runId);
    removeRun(runId);
    renderPanel();
    
    const runs = loadRuns();
    if (runs.length === 0) stopTimer();
}

// ── Timer ──────────────────────────────────────────────────────────────────────
function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        renderPanel();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ── Window API ─────────────────────────────────────────────────────────────────
window.__toggleHotHoldingPanel = function() {
    isPanelMin = !isPanelMin;
    renderPanel();
};

window.__toggleHotHoldingCard = function(runId) {
    if (expandedRunIds.has(runId)) {
        expandedRunIds.delete(runId);
    } else {
        expandedRunIds.add(runId);
    }
    renderPanel();
};

window.__measureHotHoldingTemp = async function(runId) {
    const temp = prompt("Indtast målt temperatur (°C):");
    if (temp === null) return;
    
    const temperature = parseFloat(temp);
    if (isNaN(temperature)) {
        alert("Ugyldig temperatur");
        return;
    }
    
    const run = updateHotHoldingTemperature(runId, temperature);
    
    if (run && temperature < 65) {
        alert(`⚠️ AFVIGELSE: Temperatur under 65°C!\n\nMaden er målt under 65°C. Vurder hvor længe temperaturen har været for lav.\n\nGenopvarm til mindst 75°C hvis det er fødevaresikkerhedsmæssigt forsvarligt, ellers kassér maden.\n\nNotér årsag og handling i rutinen.`);
    }
};

window.__stopHotHoldingRun = function(runId) {
    if (confirm("Stop varmholdelse for denne enhed?")) {
        stopHotHoldingRun(runId);
    }
};

// ── Init ───────────────────────────────────────────────────────────────────────
export function initHotHoldingOverlay() {
    console.log("[hot holding] Initializing overlay");
    
    const auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("[hot holding] User authenticated, subscribing to Firestore");
            subscribeToFirestoreRuns();
        } else {
            console.log("[hot holding] User signed out");
            if (firestoreUnsub) {
                firestoreUnsub();
                firestoreUnsub = null;
            }
        }
    });
    
    // Restore active runs
    const runs = loadRuns();
    if (runs.length > 0) {
        console.log("[hot holding restore] Found", runs.length, "active runs");
        renderPanel();
        startTimer();
    }
    
    // Add styles
    injectStyles();
}

function injectStyles() {
    if (document.getElementById("mk-hot-holding-styles")) return;
    
    const style = document.createElement("style");
    style.id = "mk-hot-holding-styles";
    style.textContent = `
        .mk-hot-holding-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 380px;
            background: #fff;
            border: 2px solid #ff6b35;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(255, 107, 53, 0.3);
            z-index: 9999;
            font-family: system-ui, -apple-system, sans-serif;
        }
        
        .mk-hot-holding-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            background: linear-gradient(135deg, #ff6b35 0%, #ff8c42 100%);
            border-radius: 10px 10px 0 0;
            color: #fff;
        }
        
        .mk-hot-holding-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 600;
            font-size: 15px;
        }
        
        .mk-hot-holding-icon {
            font-size: 20px;
        }
        
        .mk-hot-holding-btn-min {
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: #fff;
            padding: 4px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
        }
        
        .mk-hot-holding-btn-min:hover {
            background: rgba(255, 255, 255, 0.3);
        }
        
        .mk-hot-holding-body {
            max-height: 500px;
            overflow-y: auto;
            padding: 12px;
        }
        
        .mk-hot-holding-card {
            background: #fff;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            margin-bottom: 12px;
            overflow: hidden;
        }
        
        .mk-hot-holding-card.ok {
            border-color: #4caf50;
            background: #f1f8f4;
        }
        
        .mk-hot-holding-card.deviation {
            border-color: #f44336;
            background: #ffebee;
            animation: pulse-red 2s infinite;
        }
        
        .mk-hot-holding-card.overdue {
            border-color: #ff1744;
            box-shadow: 0 0 12px rgba(255, 23, 68, 0.4);
        }
        
        @keyframes pulse-red {
            0%, 100% { box-shadow: 0 0 0 rgba(255, 23, 68, 0.4); }
            50% { box-shadow: 0 0 20px rgba(255, 23, 68, 0.8); }
        }
        
        .mk-hot-holding-card-header {
            padding: 12px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .mk-hot-holding-card-title {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        
        .mk-hot-holding-status {
            font-size: 12px;
            color: #666;
        }
        
        .mk-hot-holding-card.deviation .mk-hot-holding-status {
            color: #f44336;
            font-weight: 600;
        }
        
        .mk-hot-holding-card.ok .mk-hot-holding-status {
            color: #4caf50;
            font-weight: 600;
        }
        
        .mk-hot-holding-card-timer {
            font-size: 18px;
            font-weight: 700;
            color: #ff6b35;
        }
        
        .mk-hot-holding-card-body {
            padding: 0 12px 12px;
            border-top: 1px solid #e0e0e0;
        }
        
        .mk-hot-holding-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin: 12px 0;
        }
        
        .mk-hot-holding-info-item {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        
        .mk-hot-holding-info-label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .mk-hot-holding-info-value {
            font-size: 14px;
            font-weight: 600;
            color: #182118;
        }
        
        .mk-hot-holding-info-value.temp-ok {
            color: #4caf50;
        }
        
        .mk-hot-holding-info-value.temp-critical {
            color: #f44336;
        }
        
        .mk-hot-holding-info-value.overdue-text {
            color: #ff1744;
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 50%, 100% { opacity: 1; }
            25%, 75% { opacity: 0.5; }
        }
        
        .mk-hot-holding-actions {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }
        
        .mk-hot-holding-btn-measure,
        .mk-hot-holding-btn-stop {
            flex: 1;
            padding: 8px 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
        }
        
        .mk-hot-holding-btn-measure {
            background: #ff6b35;
            color: #fff;
        }
        
        .mk-hot-holding-btn-measure:hover {
            background: #ff8c42;
        }
        
        .mk-hot-holding-btn-stop {
            background: #e0e0e0;
            color: #333;
        }
        
        .mk-hot-holding-btn-stop:hover {
            background: #bdbdbd;
        }
    `;
    
    document.head.appendChild(style);
}

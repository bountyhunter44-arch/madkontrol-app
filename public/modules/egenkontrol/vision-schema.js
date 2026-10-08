// /modules/egenkontrol/vision-schema.js
//
// Platformsneutrale normaliserings- og schema-funktioner for egenkontrol-vision.
//
// Bevidst UI-fri: ingen DOM, ingen Firebase, ingen globals. Derfor kan præcis
// samme normalisering senere bruges af en Android-app (Kotlin/JS-bro eller en
// ren port), så web og app altid tolker AI-svaret ens.
//
// Schema (versioneret):
//   {
//     schemaVersion: 1,
//     scene: { area: "", confidence: 0 },
//     detections: [{
//       id, type: "area|surface|equipment|storage|observation|reading",
//       label, confidence,
//       boundingBox: { x, y, width, height },   // normaliserede 0..1
//       requiresHumanConfirmation, description
//     }],
//     suggestedActions: [],
//     warning: null
//   }
//
// Bagudkompatibilitet: ældre AI-svar uden de nye felter giver den tomme
// struktur, og alle eksisterende feltnavne i AI-svaret bevares urørt.

export const VISION_SCHEMA_VERSION = 1;

export const DETECTION_TYPES = Object.freeze(["area", "surface", "equipment", "storage", "observation", "reading"]);

export const MAX_DETECTIONS = 20;

/** Stabil, klient-genereret id. Samme hjælper bruges af scannerens sessioner. */
export function createStableId(prefix = "id") {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* falder igennem til tidsstempel-variant */ }
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${prefix}_${Date.now().toString(16)}${rand()}${rand()}${rand()}`;
}

export function emptyVisionAnalysis() {
  return {
    schemaVersion: VISION_SCHEMA_VERSION,
    scene: { area: "", confidence: 0 },
    detections: [],
    suggestedActions: [],
    warning: null
  };
}

function clamp01(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function detectionId(type, label, index) {
  const slug = `${type}-${label}`.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return `${slug || "fund"}-${index}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Normaliserer AI'ens strukturerede egenkontrol-fund. Kaster aldrig.
 * @param {unknown} raw
 * @returns {{schemaVersion:number,scene:{area:string,confidence:number},detections:Array,suggestedActions:string[],warning:string|null}}
 */
export function normalizeVisionAnalysis(raw) {
  const empty = emptyVisionAnalysis();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return empty;

  const area = String(raw?.scene?.area || "").trim().toLowerCase();
  const sceneConfidence = clamp01(raw?.scene?.confidence, 0) ?? 0;

  const list = Array.isArray(raw.detections) ? raw.detections : [];
  const detections = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const type = String(item.type || "").trim().toLowerCase();
    const label = String(item.label || "").trim().toLowerCase();
    if (!DETECTION_TYPES.includes(type) || !label) continue;

    const detection = {
      id: String(item.id || "").trim() || detectionId(type, label, detections.length),
      type,
      label,
      confidence: clamp01(item.confidence, 0.5) ?? 0.5
    };

    const box = item.boundingBox;
    const bx = Number(box?.x), by = Number(box?.y), bw = Number(box?.width), bh = Number(box?.height);
    if ([bx, by, bw, bh].every((v) => Number.isFinite(v))) {
      detection.boundingBox = {
        x: Math.max(0, Math.min(1, bx)),
        y: Math.max(0, Math.min(1, by)),
        width: Math.max(0, Math.min(1, bw)),
        height: Math.max(0, Math.min(1, bh))
      };
    }

    // Observationer er MULIGE fund og kræver altid menneskelig bekræftelse.
    detection.requiresHumanConfirmation = type === "observation"
      ? true
      : item.requiresHumanConfirmation === true;

    const description = String(item.description || "").trim();
    if (description) detection.description = description;

    detections.push(detection);
    if (detections.length >= MAX_DETECTIONS) break;
  }

  const suggestedActions = (Array.isArray(raw.suggestedActions) ? raw.suggestedActions : [])
    .map((a) => String(a || "").trim())
    .filter(Boolean)
    .slice(0, 10);

  const warning = String(raw.warning || "").trim();

  return {
    schemaVersion: VISION_SCHEMA_VERSION,
    scene: { area, confidence: sceneConfidence },
    detections,
    suggestedActions,
    warning: warning || null
  };
}

/**
 * Bygger det samlede normaliserede AI-resultat. Alle eksisterende feltnavne fra
 * AI-svaret bevares; de strukturerede vision-felter lægges oveni.
 * @param {object} aiResult
 */
export function normalizeAiAnalysisResult(aiResult = {}) {
  const confidence = Number(aiResult.confidenceScore ?? aiResult.confidence ?? 0);
  const confidenceScore = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
  const suggestedIssue = String(aiResult.suggestedIssue || aiResult.warning || aiResult.beskrivelse || "").trim();
  const labels = Array.isArray(aiResult.labels)
    ? aiResult.labels.map((label) => String(label || "").trim()).filter(Boolean).slice(0, 12)
    : [
        ...(Array.isArray(aiResult.observationer) ? aiResult.observationer : []),
        ...(Array.isArray(aiResult.risikoflag) ? aiResult.risikoflag : [])
      ].map((label) => String(label || "").trim()).filter(Boolean).slice(0, 12);

  const egenkontrol = normalizeVisionAnalysis(aiResult.egenkontrol || aiResult.visualAnalysis || null);

  const normalized = {
    confidence: confidenceScore,
    confidenceScore,
    severity: String(aiResult.severity || (aiResult.risikoflag?.length ? "medium" : "low")).toLowerCase(),
    suggestedIssue,
    labels,
    warning: confidenceScore >= 0.4 && suggestedIssue
      ? `AI observerede mulig urenhed (${Math.round(confidenceScore * 100)}% sikkerhed). Bekræft manuelt.`
      : "",
    createdAt: new Date().toISOString()
  };

  if (egenkontrol.detections.length || egenkontrol.scene.area || egenkontrol.warning) {
    normalized.egenkontrol = egenkontrol;
    normalized.scene = egenkontrol.scene;
    normalized.detections = egenkontrol.detections;
    normalized.suggestedActions = egenkontrol.suggestedActions;
    normalized.visionWarning = egenkontrol.warning;
    normalized.visionSchemaVersion = egenkontrol.schemaVersion;
  }

  return normalized;
}

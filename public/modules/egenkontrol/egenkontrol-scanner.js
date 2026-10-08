// /modules/egenkontrol/egenkontrol-scanner.js
//
// Egenkontrol-kamera/scanner. Bruges fra rutinekortet på mobil og desktop.
//
// Bygger på SAMME arkitektur som EWCP Regnskabs bilagsscanner
// (madkontrollen-accounting/public/modules/bilagsscan/billede.js):
//   • OpenCV.js + jscanify lazy-loades FØRST når kameraet åbnes (aldrig ved sideindlæsning)
//   • live preview via getUserMedia
//   • flade-detektion (findFladeHjorner) til perspektivkorrektion
//   • skygge-fjernelse + auto-niveauer til billedforbedring
//   • JPEG-komprimering i canvas
//
// BEVIDSTE FORSKELLE fra bilagsscanneren:
//   1. Perspektivkorrektion anvendes ALDRIG automatisk. Et egenkontrol-foto viser
//      typisk et rum, et køleskab eller en flade — en warp ville ødelægge billedet
//      for AI-vision. Den bruges KUN når OpenCV finder en egnet, rektangulær plan
//      med tilstrækkelig sikkerhed, OG brugeren aktivt trykker "Ret perspektiv".
//   2. Der er et eksplicit GODKEND-trin. Et capture gemmer intet og opretter ingen
//      afvigelse af sig selv.
//   3. Sessionen bindes til en rutine (instanceId) og valideres før upload.
//
// Ingen side-effekter ved import: bibliotekerne hentes først ved openEgenkontrolCamera().

const OPENCV_URL = "https://docs.opencv.org/4.9.0/opencv.js";
const JSCANIFY_URL = "https://cdn.jsdelivr.net/npm/jscanify@1.4.2/src/jscanify.min.js";

const MODAL_ID = "mkEgenkontrolScanner";
const STYLE_ID = "mkEgenkontrolScannerStyle";

const DEFAULTS = {
  maxEdge: 2000,
  quality: 0.85,
  title: "Tag billede",
  hint: "Ret kameraet mod det, du vil dokumentere"
};

let _libsReady = null;
let _activeSession = null;
let _lastResult = null;

/**
 * Sessionsstatus. Samme tilstandsmaskine kan senere drives af en Android-klient
 * (CameraX), så status-navnene er platformsneutrale og ikke UI-afhængige.
 */
export const SCANNER_STATUS = Object.freeze({
  OPEN: "OPEN",
  CAPTURED: "CAPTURED",
  CONFIRMED: "CONFIRMED",
  UPLOADING: "UPLOADING",
  ANALYZING: "ANALYZING",
  REVIEW: "REVIEW",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  INVALIDATED: "INVALIDATED"
});

/**
 * Stabil, klient-genereret id (UUID v4 når browseren understøtter det).
 * Stabile id'er er forudsætningen for at Android senere kan optage offline,
 * gemme lokalt og uploade bagefter uden dubletter.
 */
export function createStableId(prefix = "id") {
  try {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${prefix}_${globalThis.crypto.randomUUID()}`;
    }
  } catch { /* falder igennem */ }
  const rand = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
  return `${prefix}_${Date.now().toString(16)}${rand()}${rand()}${rand()}`;
}

// ---------------------------------------------------------------- biblioteker

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if ([...document.scripts].some((s) => s.src === src)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Kunne ikke loade " + src));
    document.head.appendChild(el);
  });
}

function waitForCv() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    (function poll() {
      const cv = window.cv;
      if (cv && cv.Mat) return resolve(cv);
      // Nogle OpenCV-builds gør window.cv til en thenable og erstatter den, når
      // WASM er klar. Derfor poller vi ALTID videre indtil cv.Mat findes.
      if (cv && typeof cv.then === "function") {
        try { cv.then((m) => { if (m && m.Mat && !(window.cv && window.cv.Mat)) window.cv = m; }); } catch { /* ignore */ }
      }
      if (Date.now() - started > 25000) return reject(new Error("OpenCV timeout"));
      setTimeout(poll, 120);
    })();
  });
}

/**
 * Lazy-load af OpenCV + jscanify. Kaldes først når kameraet åbnes.
 * Fejler den, fortsætter scanneren uden perspektivkorrektion og skygge-fjernelse.
 */
export function forberedEgenkontrolScanner() {
  if (!_libsReady) {
    _libsReady = (async () => {
      await loadScript(OPENCV_URL);
      await waitForCv();
      await loadScript(JSCANIFY_URL);
      if (!window.jscanify) throw new Error("jscanify mangler");
      return true;
    })();
  }
  return _libsReady;
}

function cvReady() {
  return window.cv && window.cv.Mat ? window.cv : null;
}

// ---------------------------------------------------------------- CSS

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${MODAL_ID}{position:fixed;inset:0;z-index:13000;display:flex;flex-direction:column;
      background:#0b0f0c;color:#fff;font-family:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;
      padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);}
    #${MODAL_ID} *{box-sizing:border-box;}
    #${MODAL_ID} .mkes-top{display:flex;align-items:center;justify-content:space-between;gap:10px;
      padding:10px 12px;flex:0 0 auto;}
    #${MODAL_ID} .mkes-title{font-size:14px;font-weight:800;letter-spacing:.01em;}
    #${MODAL_ID} .mkes-x{width:40px;height:40px;min-width:40px;border:1px solid rgba(255,255,255,.28);
      border-radius:11px;background:rgba(255,255,255,.08);color:#fff;font-size:20px;line-height:1;
      cursor:pointer;display:grid;place-items:center;}
    #${MODAL_ID} .mkes-stage{flex:1 1 auto;min-height:0;display:grid;place-items:center;padding:0 10px;position:relative;}
    #${MODAL_ID} video,#${MODAL_ID} canvas.mkes-canvas{max-width:100%;max-height:100%;display:block;
      border-radius:14px;background:#000;object-fit:contain;}
    #${MODAL_ID} .mkes-hint{position:absolute;left:50%;transform:translateX(-50%);bottom:10px;
      background:rgba(0,0,0,.62);border:1px solid rgba(255,255,255,.16);border-radius:999px;
      padding:7px 14px;font-size:12px;font-weight:700;white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis;}
    #${MODAL_ID} .mkes-crop{position:absolute;border:2px solid #35d07f;border-radius:4px;
      box-shadow:0 0 0 9999px rgba(0,0,0,.45);touch-action:none;cursor:move;}
    #${MODAL_ID} .mkes-handle{position:absolute;width:26px;height:26px;background:#35d07f;
      border:2px solid #0b0f0c;border-radius:50%;touch-action:none;}
    #${MODAL_ID} .mkes-handle[data-h="nw"]{left:-13px;top:-13px;cursor:nwse-resize;}
    #${MODAL_ID} .mkes-handle[data-h="ne"]{right:-13px;top:-13px;cursor:nesw-resize;}
    #${MODAL_ID} .mkes-handle[data-h="sw"]{left:-13px;bottom:-13px;cursor:nesw-resize;}
    #${MODAL_ID} .mkes-handle[data-h="se"]{right:-13px;bottom:-13px;cursor:nwse-resize;}
    #${MODAL_ID} .mkes-tools{display:flex;gap:6px;overflow-x:auto;padding:8px 10px 2px;flex:0 0 auto;
      scrollbar-width:none;-webkit-overflow-scrolling:touch;}
    #${MODAL_ID} .mkes-tools::-webkit-scrollbar{display:none;}
    #${MODAL_ID} .mkes-tool{flex:0 0 auto;min-height:44px;padding:8px 12px;border-radius:12px;
      border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:#fff;
      font-size:12px;font-weight:800;cursor:pointer;white-space:nowrap;}
    #${MODAL_ID} .mkes-tool.is-on{background:#35d07f;border-color:#35d07f;color:#06210f;}
    #${MODAL_ID} .mkes-tool:disabled{opacity:.4;cursor:not-allowed;}
    #${MODAL_ID} .mkes-bar{display:flex;align-items:center;justify-content:center;gap:14px;
      padding:12px 14px calc(14px + env(safe-area-inset-bottom,0px));flex:0 0 auto;}
    #${MODAL_ID} .mkes-shutter{width:78px;height:78px;min-width:78px;border-radius:50%;
      border:5px solid #fff;background:rgba(255,255,255,.22);cursor:pointer;display:grid;place-items:center;
      box-shadow:0 10px 30px rgba(0,0,0,.45);}
    #${MODAL_ID} .mkes-shutter span{width:56px;height:56px;border-radius:50%;background:#fff;display:block;}
    #${MODAL_ID} .mkes-shutter:active span{transform:scale(.94);}
    #${MODAL_ID} .mkes-btn{min-height:48px;min-width:104px;padding:10px 16px;border-radius:14px;
      font-size:14px;font-weight:800;cursor:pointer;border:1px solid rgba(255,255,255,.24);
      background:rgba(255,255,255,.10);color:#fff;}
    #${MODAL_ID} .mkes-btn-primary{background:linear-gradient(135deg,#2e7d32,#43a047);border-color:#2e7d32;color:#fff;}
    #${MODAL_ID} .mkes-btn-warn{background:rgba(220,53,69,.18);border-color:rgba(220,53,69,.7);color:#ffd9dd;}
    #${MODAL_ID} .mkes-status{position:absolute;inset:0;display:grid;place-items:center;
      background:rgba(11,15,12,.86);text-align:center;padding:24px;font-size:14px;font-weight:700;}
    #${MODAL_ID} .mkes-status small{display:block;margin-top:8px;font-weight:600;opacity:.75;font-size:12px;}
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------- canvas-hjælp

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Kunne ikke læse billedfilen.")); };
    img.src = url;
  });
}

// Roterer et canvas 0/90/180/270 grader.
function rotateCanvas(src, degrees) {
  const d = ((degrees % 360) + 360) % 360;
  if (!d) return src;
  const swap = d === 90 || d === 270;
  const out = makeCanvas(swap ? src.height : src.width, swap ? src.width : src.height);
  const ctx = out.getContext("2d");
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((d * Math.PI) / 180);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return out;
}

// Beskærer efter normaliseret rect {x,y,w,h} i 0..1.
function cropCanvas(src, rect) {
  if (!rect) return src;
  const x = Math.max(0, Math.min(1, rect.x)) * src.width;
  const y = Math.max(0, Math.min(1, rect.y)) * src.height;
  const w = Math.max(1, Math.min(src.width - x, rect.w * src.width));
  const h = Math.max(1, Math.min(src.height - y, rect.h * src.height));
  const out = makeCanvas(w, h);
  out.getContext("2d").drawImage(src, x, y, w, h, 0, 0, out.width, out.height);
  return out;
}

// Nedskalering så længste kant <= maxEdge.
function fitCanvas(src, maxEdge) {
  const longest = Math.max(src.width, src.height);
  if (longest <= maxEdge) return src;
  const scale = maxEdge / longest;
  const out = makeCanvas(src.width * scale, src.height * scale);
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, 0, 0, out.width, out.height);
  return out;
}

// Lys/kontrast-normalisering uden OpenCV: auto-niveauer på luminans + blød S-kurve.
function enhanceCanvas(src) {
  const out = makeCanvas(src.width, src.height);
  const ctx = out.getContext("2d");
  ctx.drawImage(src, 0, 0);
  try {
    const data = ctx.getImageData(0, 0, out.width, out.height);
    const d = data.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      hist[(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0] += 1;
    }
    const total = d.length / 4;
    const lowCut = total * 0.005;
    const highCut = total * 0.005;
    let acc = 0, low = 0, high = 255;
    for (let v = 0; v < 256; v += 1) { acc += hist[v]; if (acc >= lowCut) { low = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v -= 1) { acc += hist[v]; if (acc >= highCut) { high = v; break; } }
    if (high - low >= 24) {
      const scale = 255 / (high - low);
      // lineær auto-niveau + let kontrast-løft (1.10)
      for (let i = 0; i < d.length; i += 4) {
        for (let c = 0; c < 3; c += 1) {
          let v = (d[i + c] - low) * scale;
          v = (v - 128) * 1.1 + 128;
          d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
        }
      }
      ctx.putImageData(data, 0, 0);
    }
  } catch (error) {
    console.warn("[egenkontrol-scanner] forbedring sprunget over:", error?.message);
  }
  return out;
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

// -------------------------------------------------- OpenCV: flade + perspektiv

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function sortCorners(pts) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const sorted = [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  // start ved øverste-venstre (mindste x+y)
  let startIdx = 0, best = Infinity;
  sorted.forEach((p, i) => { const s = p.x + p.y; if (s < best) { best = s; startIdx = i; } });
  return [...sorted.slice(startIdx), ...sorted.slice(0, startIdx)];
}

function quadArea(p) {
  let a = 0;
  for (let i = 0; i < p.length; i += 1) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a) / 2;
}

function isConvex(p) {
  let sign = 0;
  for (let i = 0; i < p.length; i += 1) {
    const a = p[i], b = p[(i + 1) % p.length], c = p[(i + 2) % p.length];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// Forholdet mellem omkreds og areal — afviser tynde/skæve firkanter.
function thinness(quad) {
  const per = quad.reduce((s, p, i) => s + dist(p, quad[(i + 1) % quad.length]), 0);
  const area = quadArea(quad);
  return area > 0 ? (per * per) / area : Infinity;
}

/**
 * Finder en egnet rektangulær plan i billedet med OpenCV.
 * Returnerer { corners, coverage } eller null.
 *
 * "Egnet" er bevidst strengt: perspektivkorrektion må kun tilbydes når der
 * faktisk ER en plan flade — ellers ville et foto af et rum blive warpet.
 */
function detectPlane(canvas, cv) {
  const MATS = [];
  const track = (m) => { MATS.push(m); return m; };
  try {
    const w = canvas.width, h = canvas.height;
    const downW = 480;
    const scale = downW / w;
    const downH = Math.round(h * scale);
    const small = makeCanvas(downW, downH);
    small.getContext("2d").drawImage(canvas, 0, 0, downW, downH);

    const src = track(cv.imread(small));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const blur = track(new cv.Mat());
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    const edges = track(new cv.Mat());
    cv.Canny(blur, edges, 60, 180);
    const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)));
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);

    const contours = track(new cv.MatVector());
    const hierarchy = track(new cv.Mat());
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    let bestArea = 0;
    const totalArea = downW * downH;
    for (let i = 0; i < contours.size(); i += 1) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      // Fladen skal fylde mellem 18% og 96% — hverken en lille detalje eller hele billedet.
      if (area < totalArea * 0.18 || area > totalArea * 0.96) continue;
      const peri = cv.arcLength(c, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(c, approx, 0.02 * peri, true);
      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const pts = [];
        for (let k = 0; k < 4; k += 1) {
          pts.push({ x: approx.data32S[k * 2] / scale, y: approx.data32S[k * 2 + 1] / scale });
        }
        const quad = sortCorners(pts);
        if (isConvex(quad) && thinness(quad) <= 6) {
          const qArea = quadArea(quad);
          if (qArea > bestArea) { bestArea = qArea; best = quad; }
        }
      }
      approx.delete();
    }

    if (!best) return null;
    const coverage = bestArea / (w * h);
    if (coverage < 0.18 || coverage > 0.96) return null;
    return { corners: best, coverage };
  } catch (error) {
    console.warn("[egenkontrol-scanner] flade-detektion fejlede:", error?.message);
    return null;
  } finally {
    MATS.forEach((m) => { try { m.delete(); } catch { /* ignore */ } });
  }
}

function warpPlane(canvas, corners, cv, maxEdge) {
  const MATS = [];
  const track = (m) => { MATS.push(m); return m; };
  try {
    const [tl, tr, br, bl] = corners;
    const w = Math.max(dist(tl, tr), dist(bl, br));
    const h = Math.max(dist(tl, bl), dist(tr, br));
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    const dw = Math.max(1, Math.round(w * scale));
    const dh = Math.max(1, Math.round(h * scale));

    const src = track(cv.imread(canvas));
    const srcTri = track(cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]));
    const dstTri = track(cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, dw, 0, dw, dh, 0, dh]));
    const M = track(cv.getPerspectiveTransform(srcTri, dstTri));
    const dst = track(new cv.Mat());
    cv.warpPerspective(src, dst, M, new cv.Size(dw, dh), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(255, 255, 255, 255));
    const out = makeCanvas(dw, dh);
    cv.imshow(out, dst);
    return out;
  } catch (error) {
    console.warn("[egenkontrol-scanner] perspektivkorrektion fejlede:", error?.message);
    return null;
  } finally {
    MATS.forEach((m) => { try { m.delete(); } catch { /* ignore */ } });
  }
}

/**
 * Skygge-/belysnings-fjernelse (OpenCV). Returnerer et nyt canvas eller null.
 * Samme algoritme som bilagsscanneren: estimér det lavfrekvente lys og divider ud.
 */
function removeShadows(canvas, cv) {
  const MATS = [];
  const track = (m) => { MATS.push(m); return m; };
  try {
    const w = canvas.width, h = canvas.height;
    const src = track(cv.imread(canvas));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const f = 0.15;
    const sw = Math.max(1, Math.round(w * f));
    const sh = Math.max(1, Math.round(h * f));
    const small = track(new cv.Mat());
    cv.resize(gray, small, new cv.Size(sw, sh), 0, 0, cv.INTER_AREA);
    const sblur = track(new cv.Mat());
    let ks = Math.round(Math.max(sw, sh) / 4);
    if (ks % 2 === 0) ks += 1;
    ks = Math.max(11, ks);
    cv.GaussianBlur(small, sblur, new cv.Size(ks, ks), 0, 0, cv.BORDER_REPLICATE);
    const bg = track(new cv.Mat());
    cv.resize(sblur, bg, new cv.Size(w, h), 0, 0, cv.INTER_LINEAR);

    const grayF = track(new cv.Mat()), bgF = track(new cv.Mat()), normF = track(new cv.Mat());
    gray.convertTo(grayF, cv.CV_32F);
    bg.convertTo(bgF, cv.CV_32F);
    cv.divide(grayF, bgF, normF, 255);
    const norm = track(new cv.Mat());
    normF.convertTo(norm, cv.CV_8U);
    cv.normalize(norm, norm, 0, 255, cv.NORM_MINMAX);

    const outR = track(new cv.Mat());
    cv.cvtColor(norm, outR, cv.COLOR_GRAY2RGBA);
    const out = makeCanvas(w, h);
    cv.imshow(out, outR);
    return out;
  } catch (error) {
    console.warn("[egenkontrol-scanner] skygge-fjernelse fejlede:", error?.message);
    return null;
  } finally {
    MATS.forEach((m) => { try { m.delete(); } catch { /* ignore */ } });
  }
}

// ---------------------------------------------------------------- session

/**
 * Aktiv camerasession. Sættes når kameraet åbnes og ryddes når det lukkes.
 * Rutinekortet bruger den til at opdage et rutineskift midt i flowet.
 *
 * Modellen er bevidst platformsneutral og indeholder kun data — ingen DOM,
 * ingen closures. En Android-klient kan bygge præcis samme objekt.
 */
export function getActiveCameraSession() {
  if (!_activeSession) return null;
  const { __close, ...data } = _activeSession;
  return { ...data };
}

/** Seneste afsluttede resultat (til genvisning/Android-paritet). */
export function getLastScannerResult() {
  return _lastResult ? { ..._lastResult } : null;
}

/** Opdaterer sessionens status (samme tilstandsmaskine på alle platforme). */
export function setCameraSessionStatus(status) {
  if (!_activeSession) return false;
  if (!Object.values(SCANNER_STATUS).includes(status)) return false;
  _activeSession.status = status;
  return true;
}

/** Lukker en aktiv session udefra (fx når brugeren skifter rutine). */
export function cancelActiveCameraSession(reason = "cancelled") {
  if (!_activeSession) return false;
  _activeSession.invalidated = true;
  _activeSession.invalidReason = reason;
  _activeSession.status = SCANNER_STATUS.INVALIDATED;
  if (typeof _activeSession.__close === "function") {
    try { _activeSession.__close(reason); } catch { /* ignore */ }
  }
  _activeSession = null;
  return true;
}

/** Er sessionen stadig den aktuelle for det givne rutine-instance-id? */
export function isCameraSessionValidFor(instanceId) {
  return Boolean(_activeSession && !_activeSession.invalidated && _activeSession.instanceId === instanceId);
}

// ------- Granulær API (samme kontrakt som en fremtidig Android-klient kan bruge)

/** Driver den åbne scanner videre til capture. Returnerer true hvis kaldet blev accepteret. */
export function captureCurrentFrame() {
  if (!_activeSession || typeof _activeSession.__capture !== "function") return false;
  return _activeSession.__capture();
}

export function rotateCurrentImage() {
  if (!_activeSession || typeof _activeSession.__rotate !== "function") return false;
  return _activeSession.__rotate();
}

export function confirmCurrentImage() {
  if (!_activeSession || typeof _activeSession.__confirm !== "function") return false;
  return _activeSession.__confirm();
}

export function cancelScanner() {
  return cancelActiveCameraSession("user_cancelled");
}

// ---------------------------------------------------------------- hovedflow

/**
 * Åbner egenkontrol-kameraet.
 *
 * @param {object} opts
 * @param {string} opts.instanceId  Rutinens task-instance-id (bindes til sessionen)
 * @param {string} [opts.routineName]
 * @param {string} [opts.title]
 * @param {string} [opts.hint]
 * @param {number} [opts.maxEdge=2000]
 * @param {number} [opts.quality=0.85]
 * @returns {Promise<null | {sessionId,instanceId,routineName,blob,file,width,height,
 *   rotation,enhanced,perspective,usedShadowRemoval,planeOffered,planeCoverage}>}
 *   null hvis brugeren annullerede.
 */
export async function openEgenkontrolCamera(opts = {}) {
  const options = { ...DEFAULTS, ...opts };
  const instanceId = String(options.instanceId || "").trim();
  if (!instanceId) throw new Error("Kamera kræver et rutine-instance-id.");

  // Kun én aktiv session ad gangen.
  if (_activeSession) cancelActiveCameraSession("replaced");

  injectStyles();

  const session = {
    // ---- platformsneutral session-model (kan genbruges 1:1 fra Android) ----
    sessionId: createStableId("cam"),
    companyId: String(options.companyId || ""),
    instanceId,
    routineId: String(options.routineId || instanceId),
    routineName: String(options.routineName || ""),
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: SCANNER_STATUS.OPEN,
    platform: "web",
    // ----------------------------------------------------------------------
    invalidated: false,
    invalidReason: "",
    // Interne hooks (strippes i getActiveCameraSession()).
    __close: null,
    __capture: null,
    __rotate: null,
    __confirm: null
  };
  _activeSession = session;

  // ---- DOM ----
  const root = document.createElement("div");
  root.id = MODAL_ID;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", options.title);
  root.innerHTML = `
    <div class="mkes-top">
      <div class="mkes-title">${escapeHtml(options.title)}</div>
      <button type="button" class="mkes-x" data-act="close" aria-label="Luk kamera">×</button>
    </div>
    <div class="mkes-stage" data-stage>
      <video data-video playsinline autoplay muted></video>
      <div class="mkes-hint" data-hint>${escapeHtml(options.hint)}</div>
    </div>
    <div class="mkes-tools" data-tools hidden>
      <button type="button" class="mkes-tool" data-act="rotate" title="Rotér 90 grader">↻ Rotér</button>
      <button type="button" class="mkes-tool" data-act="crop" title="Beskær billedet">⛶ Beskær</button>
      <button type="button" class="mkes-tool" data-act="enhance" title="Forbedr lys og kontrast">✨ Forbedr</button>
      <button type="button" class="mkes-tool" data-act="perspective" title="Ret perspektiv (kun når der er en plan flade)" disabled>▱ Ret perspektiv</button>
      <button type="button" class="mkes-tool" data-act="reset" title="Nulstil redigering">⟲ Nulstil</button>
    </div>
    <div class="mkes-bar" data-bar></div>
  `;
  document.body.appendChild(root);

  const stage = root.querySelector("[data-stage]");
  const video = root.querySelector("[data-video]");
  const hintEl = root.querySelector("[data-hint]");
  const toolsEl = root.querySelector("[data-tools]");
  const barEl = root.querySelector("[data-bar]");

  let stream = null;
  let cv = null;
  let baseCanvas = null;      // fanget original
  let rotation = 0;
  let cropRect = null;        // normaliseret {x,y,w,h}
  let enhanced = false;
  let perspectiveCanvas = null; // resultat af warp (cachet)
  let planeInfo = null;       // { corners, coverage }
  let usedShadowRemoval = false;
  let closed = false;
  let finish = null;

  function closeModal() {
    if (closed) return;
    closed = true;
    try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { root.remove(); } catch { /* ignore */ }
    if (_activeSession && _activeSession.sessionId === session.sessionId) _activeSession = null;
  }

  session.__close = (reason) => {
    session.invalidated = true;
    session.invalidReason = reason;
    closeModal();
    if (finish && !finished) { finished = true; finish(null); }
  };

  let finished = false;
  const result = await new Promise((resolve) => {
    finish = (value) => { if (finished) return; finished = true; resolve(value); };

    // -------------------------------------------------- live-tilstand
    function renderLive() {
      toolsEl.hidden = true;
      stage.innerHTML = "";
      stage.appendChild(video);
      stage.appendChild(hintEl);
      video.style.display = "block";
      barEl.innerHTML = `<button type="button" class="mkes-btn" data-act="cancel">Annullér</button>
        <button type="button" class="mkes-shutter" data-act="capture" aria-label="Tag billede"><span></span></button>
        <button type="button" class="mkes-btn" data-act="gallery">Vælg fil</button>`;
      bindBar();
      hintEl.textContent = options.hint;
    }

    // -------------------------------------------------- review-tilstand
    function renderReview() {
      toolsEl.hidden = false;
      stage.innerHTML = "";
      const canvas = document.createElement("canvas");
      canvas.className = "mkes-canvas";
      stage.appendChild(canvas);
      const cropBox = document.createElement("div");
      cropBox.className = "mkes-crop";
      cropBox.hidden = true;
      cropBox.innerHTML = ["nw", "ne", "sw", "se"].map((h) => `<div class="mkes-handle" data-h="${h}"></div>`).join("");
      stage.appendChild(cropBox);
      barEl.innerHTML = `<button type="button" class="mkes-btn" data-act="retake">↺ Tag igen</button>
        <button type="button" class="mkes-btn mkes-btn-primary" data-act="approve">✓ Godkend billede</button>`;
      bindBar();
      const cropBtn = toolsEl.querySelector('[data-act="crop"]');
      const perspBtn = toolsEl.querySelector('[data-act="perspective"]');

      function currentBase() {
        if (perspectiveCanvas) return perspectiveCanvas;
        let c = baseCanvas;
        if (rotation) c = rotateCanvas(c, rotation);
        return c;
      }

      function redraw() {
        const src = currentBase();
        const shown = cropRect ? cropCanvas(src, cropRect) : src;
        const out = enhanced ? enhanceCanvas(shown) : shown;
        canvas.width = out.width;
        canvas.height = out.height;
        canvas.getContext("2d").drawImage(out, 0, 0);
        // crop-overlay følger det viste canvas
        if (!cropBox.hidden && cropRect) {
          const r = canvas.getBoundingClientRect();
          const s = stage.getBoundingClientRect();
          cropBox.style.left = `${r.left - s.left + cropRect.x * r.width}px`;
          cropBox.style.top = `${r.top - s.top + cropRect.y * r.height}px`;
          cropBox.style.width = `${cropRect.w * r.width}px`;
          cropBox.style.height = `${cropRect.h * r.height}px`;
        }
      }

      function setCropVisible(on) {
        cropBox.hidden = !on;
        cropBtn.classList.toggle("is-on", on);
        if (on) {
          if (!cropRect) cropRect = { x: 0.06, y: 0.06, w: 0.88, h: 0.88 };
        } else {
          cropRect = null;
        }
        redraw();
      }

      cropBtn.onclick = () => setCropVisible(cropBox.hidden);
      toolsEl.querySelector('[data-act="rotate"]').onclick = () => {
        rotation = (rotation + 90) % 360;
        perspectiveCanvas = null;
        planeInfo = null;
        updatePerspectiveButton();
        redraw();
      };
      toolsEl.querySelector('[data-act="enhance"]').onclick = (event) => {
        enhanced = !enhanced;
        event.currentTarget.classList.toggle("is-on", enhanced);
        redraw();
      };
      toolsEl.querySelector('[data-act="reset"]').onclick = () => {
        rotation = 0; cropRect = null; enhanced = false;
        perspectiveCanvas = null; planeInfo = null;
        cropBox.hidden = true;
        cropBtn.classList.remove("is-on");
        toolsEl.querySelector('[data-act="enhance"]').classList.remove("is-on");
        updatePerspectiveButton();
        redraw();
      };

      function updatePerspectiveButton() {
        if (perspectiveCanvas) {
          perspBtn.disabled = false;
          perspBtn.classList.add("is-on");
          perspBtn.textContent = "▱ Fortryd perspektiv";
          perspBtn.title = "Fortryd perspektivkorrektion";
          return;
        }
        perspBtn.classList.remove("is-on");
        perspBtn.textContent = "▱ Ret perspektiv";
        if (!cv) {
          perspBtn.disabled = true;
          perspBtn.title = "Scanner-biblioteket er ikke indlæst";
          return;
        }
        perspBtn.disabled = !planeInfo;
        perspBtn.title = planeInfo
          ? `Plan flade fundet (fylder ${Math.round(planeInfo.coverage * 100)}%) — tryk for at rette perspektivet`
          : "Ingen tydelig plan flade fundet i billedet — perspektivkorrektion er ikke relevant her";
      }

      perspBtn.onclick = () => {
        if (perspectiveCanvas) { perspectiveCanvas = null; updatePerspectiveButton(); redraw(); return; }
        if (!cv || !planeInfo) return;
        const warped = warpPlane(baseCanvas, planeInfo.corners, cv, options.maxEdge);
        if (!warped) { hintToast("Kunne ikke rette perspektivet"); return; }
        perspectiveCanvas = warped;
        rotation = 0;
        cropRect = null;
        cropBox.hidden = true;
        cropBtn.classList.remove("is-on");
        updatePerspectiveButton();
        redraw();
      };

      // ---- crop-interaktion (mus + touch) ----
      let drag = null;
      function pointerPos(ev) {
        const r = canvas.getBoundingClientRect();
        const t = ev.touches ? ev.touches[0] : ev;
        return { x: (t.clientX - r.left) / r.width, y: (t.clientY - r.top) / r.height };
      }
      function startDrag(ev, mode) {
        if (cropBox.hidden) return;
        ev.preventDefault();
        drag = { mode, start: pointerPos(ev), rect: { ...cropRect } };
        window.addEventListener("pointermove", onDrag);
        window.addEventListener("pointerup", endDrag);
      }
      function onDrag(ev) {
        if (!drag) return;
        const p = pointerPos(ev);
        const dx = p.x - drag.start.x;
        const dy = p.y - drag.start.y;
        const r = { ...drag.rect };
        const min = 0.08;
        if (drag.mode === "move") {
          r.x = Math.max(0, Math.min(1 - r.w, drag.rect.x + dx));
          r.y = Math.max(0, Math.min(1 - r.h, drag.rect.y + dy));
        } else {
          if (drag.mode.includes("w")) { const nx = Math.max(0, Math.min(drag.rect.x + drag.rect.w - min, drag.rect.x + dx)); r.w = drag.rect.x + drag.rect.w - nx; r.x = nx; }
          if (drag.mode.includes("e")) { r.w = Math.max(min, Math.min(1 - drag.rect.x, drag.rect.w + dx)); }
          if (drag.mode.includes("n")) { const ny = Math.max(0, Math.min(drag.rect.y + drag.rect.h - min, drag.rect.y + dy)); r.h = drag.rect.y + drag.rect.h - ny; r.y = ny; }
          if (drag.mode.includes("s")) { r.h = Math.max(min, Math.min(1 - drag.rect.y, drag.rect.h + dy)); }
        }
        cropRect = r;
        redraw();
      }
      function endDrag() {
        drag = null;
        window.removeEventListener("pointermove", onDrag);
        window.removeEventListener("pointerup", endDrag);
      }
      cropBox.addEventListener("pointerdown", (ev) => { if (ev.target === cropBox) startDrag(ev, "move"); });
      cropBox.querySelectorAll(".mkes-handle").forEach((h) => {
        h.addEventListener("pointerdown", (ev) => startDrag(ev, h.dataset.h));
      });
      // BEMÆRK: ingen "resize"-lytter her. En redraw under resize kan ændre
      // layoutet, hvilket fyrer et nyt resize — det gav en uendelig løkke.
      // Overlayet ligger i procent og følger derfor automatisk med.

      canvas.__redraw = redraw;
      canvas.__updatePerspective = updatePerspectiveButton;
      redraw();

      // Flade-detektion i baggrunden (kræver OpenCV) — påvirker KUN perspektiv-knappen.
      forberedEgenkontrolScanner()
        .then(() => {
          cv = cvReady();
          if (!cv || closed) return;
          const found = detectPlane(baseCanvas, cv);
          if (closed) return;
          planeInfo = found;
          updatePerspectiveButton();
        })
        .catch(() => { updatePerspectiveButton(); });
    }

    function hintToast(text) {
      hintEl.textContent = text;
      setTimeout(() => { if (!closed && !toolsEl.hidden) hintEl.textContent = ""; }, 2600);
    }

    // -------------------------------------------------- capture
    function captureFrame() {
      const vw = video.videoWidth, vh = video.videoHeight;
      if (!vw || !vh) throw new Error("Kameraet er ikke klar endnu.");
      const c = makeCanvas(vw, vh);
      c.getContext("2d").drawImage(video, 0, 0, vw, vh);
      return c;
    }

    function goReview(fromCanvas) {
      baseCanvas = fromCanvas;
      rotation = 0; cropRect = null; enhanced = false;
      perspectiveCanvas = null; planeInfo = null;
      try { if (stream) stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      stream = null;
      session.status = SCANNER_STATUS.CAPTURED;
      renderReview();
    }

    function goLive() {
      baseCanvas = null; rotation = 0; cropRect = null; enhanced = false;
      perspectiveCanvas = null; planeInfo = null;
      session.status = SCANNER_STATUS.OPEN;
      renderLive();
      startCamera();
    }

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        hintEl.textContent = "Kameraet er ikke tilgængeligt i denne browser — vælg en fil i stedet.";
        return;
      }
      try {
        // Forsøg bagkamera først; fald tilbage til et vilkårligt kamera hvis
        // enheden ikke har et selvstændigt bagkamera (typisk desktop/webcam).
        const forsøg = [
          { video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
          { video: true, audio: false }
        ];
        let sidsteFejl = null;
        for (const constraints of forsøg) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (stream) break;
          } catch (error) {
            sidsteFejl = error;
          }
        }
        if (!stream) throw sidsteFejl || new Error("Intet kamera tilgængeligt.");
        if (closed) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream;
        hintEl.textContent = options.hint;
      } catch (error) {
        console.warn("[egenkontrol-scanner] kamera nægtet:", error);
        hintEl.textContent = "Kameraadgang blev afvist — vælg en fil i stedet.";
      }
    }

    function bindBar() {
      barEl.querySelectorAll("[data-act]").forEach((btn) => {
        btn.onclick = async () => {
          const act = btn.dataset.act;
          if (act === "cancel" || act === "close") {
            session.status = SCANNER_STATUS.CANCELLED;
            session.endedAt = new Date().toISOString();
            closeModal();
            finish(null);
            return;
          }
          if (act === "capture") {
            try {
              const c = captureFrame();
              goReview(c);
            } catch (error) {
              hintEl.textContent = error.message;
            }
            return;
          }
          if (act === "gallery") {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*";
            input.onchange = async () => {
              const file = input.files && input.files[0];
              if (!file) return;
              hintEl.textContent = "Indlæser…";
              try {
                const img = await imageFromFile(file);
                const c = makeCanvas(img.naturalWidth, img.naturalHeight);
                c.getContext("2d").drawImage(img, 0, 0);
                goReview(c);
              } catch (error) {
                hintEl.textContent = error.message;
              }
            };
            input.click();
            return;
          }
          if (act === "retake") { goLive(); return; }
          if (act === "approve") {
            btn.disabled = true;
            // ---- VALIDERING: sessionen skal stadig være den aktuelle rutine ----
            if (session.invalidated) {
              alert("Rutinen er skiftet. Tag billedet igen på den aktuelle rutine.");
              closeModal();
              finish(null);
              return;
            }
            try {
              const canvas = stage.querySelector("canvas.mkes-canvas");
              const visible = canvas.__redraw ? canvas : null;
              if (!visible) throw new Error("Intet billede at godkende.");
              const src = perspectiveCanvas
                ? perspectiveCanvas
                : (rotation ? rotateCanvas(baseCanvas, rotation) : baseCanvas);
              const shown = cropRect ? cropCanvas(src, cropRect) : src;
              let finalCanvas = enhanced ? enhanceCanvas(shown) : shown;

              // Skygge-fjernelse (OpenCV) kun når brugeren har slået forbedring til.
              if (enhanced && cv) {
                const clean = removeShadows(finalCanvas, cv);
                if (clean) { finalCanvas = clean; usedShadowRemoval = true; }
              }

              finalCanvas = fitCanvas(finalCanvas, options.maxEdge);
              const blob = await canvasToBlob(finalCanvas, options.quality);
              if (!blob) throw new Error("Kunne ikke komprimere billedet.");

              const file = new File(
                [blob],
                `egenkontrol_${session.instanceId}_${Date.now()}.jpg`,
                { type: "image/jpeg", lastModified: Date.now() }
              );

              const payload = {
                sessionId: session.sessionId,
                instanceId: session.instanceId,
                routineId: session.routineId,
                routineName: session.routineName,
                startedAt: session.startedAt,
                blob,
                file,
                width: finalCanvas.width,
                height: finalCanvas.height,
                rotation,
                enhanced,
                perspective: Boolean(perspectiveCanvas),
                usedShadowRemoval,
                planeOffered: Boolean(planeInfo),
                planeCoverage: planeInfo ? Number(planeInfo.coverage.toFixed(3)) : null
              };

              // Status for den platformsneutrale tilstandsmaskine.
              session.status = SCANNER_STATUS.CONFIRMED;
              session.endedAt = new Date().toISOString();
              _lastResult = {
                sessionId: payload.sessionId,
                companyId: session.companyId,
                instanceId: payload.instanceId,
                routineId: payload.routineId,
                routineName: payload.routineName,
                status: SCANNER_STATUS.CONFIRMED,
                startedAt: payload.startedAt,
                endedAt: session.endedAt,
                width: payload.width,
                height: payload.height,
                rotation: payload.rotation,
                enhanced: payload.enhanced,
                perspective: payload.perspective
              };

              closeModal();
              finish(payload);
            } catch (error) {
              console.error("[egenkontrol-scanner] godkend fejlede:", error);
              alert(error?.message || "Kunne ikke behandle billedet.");
              btn.disabled = false;
            }
          }
        };
      });
    }

    root.querySelector('[data-act="close"]').onclick = () => {
      session.status = SCANNER_STATUS.CANCELLED;
      session.endedAt = new Date().toISOString();
      closeModal();
      finish(null);
    };

    // Granulære hooks til den offentlige API (samme kontrakt som Android senere
    // kan kalde): capture / rotate / confirm / cancel.
    session.__capture = () => {
      if (closed) return false;
      if (toolsEl.hidden) {
        try { goReview(captureFrame()); return true; } catch (error) { hintEl.textContent = error.message; return false; }
      }
      return false;
    };
    session.__rotate = () => {
      if (closed || toolsEl.hidden) return false;
      const btn = toolsEl.querySelector('[data-act="rotate"]');
      if (!btn) return false;
      btn.click();
      return true;
    };
    session.__confirm = () => {
      if (closed || toolsEl.hidden) return false;
      const btn = barEl.querySelector('[data-act="approve"]');
      if (!btn) return false;
      btn.click();
      return true;
    };

    goLive();
  });

  return result;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

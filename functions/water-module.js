"use strict";
const admin     = require("firebase-admin");
const functions = require("firebase-functions");
const db        = admin.firestore();
const { FieldValue } = admin.firestore;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function ss(v, max = 500)  { return String(v ?? "").trim().slice(0, max); }
function toFloat(v)        { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : null; }
function toInt(v)          { const n = Math.floor(Number(v)); return (Number.isFinite(n) && n >= 0) ? n : 0; }
function toMoney(v)        { const n = Number(v); return (Number.isFinite(n) && n >= 0) ? Math.round(n * 100) / 100 : 0; }

function dateKeyNow() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
}
function monthKeyNow() { return dateKeyNow().slice(0, 7); }

async function assertAccess(uid, companyId) {
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) throw new functions.https.HttpsError("permission-denied", "Brugerprofil ikke fundet.");
  const d    = snap.data() || {};
  const role = ss(d.role || "", 80).toLowerCase();
  if (role === "super-admin") return d;
  const cid  = ss(d.companyId || d.organizationId, 120);
  if (!cid || cid !== companyId) throw new functions.https.HttpsError("permission-denied", "Adgang nægtet.");
  return d;
}

// ─── CREATE WATER SYSTEM ─────────────────────────────────────────────────────
exports.createWaterSystem = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId  = ss(data?.companyId,  120);
  const locationId = ss(data?.locationId, 120);
  if (!companyId || !locationId) throw new functions.https.HttpsError("invalid-argument", "companyId og locationId kræves.");
  await assertAccess(auth.uid, companyId);

  const systemId = `${companyId}__${locationId}__ws__${Date.now()}`;
  await db.collection("water_systems").doc(systemId).set({
    companyId, locationId, organizationId: companyId,
    systemId,
    name:                 ss(data?.name,     140),
    systemType:           ss(data?.systemType || "ro_system", 80),
    model:                ss(data?.model,    140),
    location:             ss(data?.location, 200),
    status:               "active",
    installationDate:     ss(data?.installationDate, 30),
    roomCoverage:         toInt(data?.roomCoverage),
    capacityLitersPerDay: toFloat(data?.capacityLitersPerDay) ?? 0,
    notes:                ss(data?.notes, 1000),
    createdBy:            auth.uid,
    createdAt:            FieldValue.serverTimestamp(),
    updatedAt:            FieldValue.serverTimestamp()
  });
  return { ok: true, systemId };
});

// ─── UPDATE SYSTEM STATUS ────────────────────────────────────────────────────
exports.updateWaterSystemStatus = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId = ss(data?.companyId, 120);
  const systemId  = ss(data?.systemId, 200);
  if (!companyId || !systemId) throw new functions.https.HttpsError("invalid-argument", "Mangler parametre.");
  await assertAccess(auth.uid, companyId);
  const valid  = ["active", "service", "offline", "decommissioned"];
  const status = valid.includes(data?.status) ? data.status : "active";
  await db.collection("water_systems").doc(systemId).update({ status, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
});

// ─── RECORD WATER MEASUREMENT ────────────────────────────────────────────────
exports.recordWaterMeasurement = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId  = ss(data?.companyId,  120);
  const locationId = ss(data?.locationId, 120);
  const systemId   = ss(data?.systemId,   200);
  if (!companyId || !locationId || !systemId)
    throw new functions.https.HttpsError("invalid-argument", "companyId, locationId og systemId kræves.");
  await assertAccess(auth.uid, companyId);

  const ph          = toFloat(data?.ph);
  const tds         = toFloat(data?.tds);
  const temperature = toFloat(data?.temperature);
  const bacteriaStatus = ["ok", "warning", "failed"].includes(data?.bacteriaStatus) ? data.bacteriaStatus : "ok";
  const clarityStatus  = ["clear", "cloudy", "discolored"].includes(data?.clarityStatus) ? data.clarityStatus : "clear";

  const hasDeviation =
    (ph  !== null && (ph < 6.5 || ph > 8.5)) ||
    (tds !== null && tds > 500)               ||
    bacteriaStatus !== "ok"                   ||
    clarityStatus  !== "clear";

  const docRef = await db.collection("water_measurements").add({
    companyId, locationId, organizationId: companyId,
    systemId,
    dateKey:         dateKeyNow(),
    timestamp:       FieldValue.serverTimestamp(),
    ph, tds, temperature,
    bacteriaStatus, clarityStatus, hasDeviation,
    notes:           ss(data?.notes, 1000),
    photoUrls:       Array.isArray(data?.photoUrls) ? data.photoUrls.slice(0, 5).map(u => ss(u, 2000)) : [],
    recordedBy:      auth.uid,
    recordedByEmail: ss(auth.token?.email || "", 160),
    createdAt:       FieldValue.serverTimestamp()
  });

  if (hasDeviation) {
    await db.collection("water_alerts").add({
      companyId, locationId, organizationId: companyId,
      systemId, measurementId: docRef.id,
      severity:  bacteriaStatus === "failed" ? "critical" : "warning",
      alertType: "quality_deviation",
      status:    "open",
      message:   `Vandkvalitet afvigelse: pH ${ph ?? "–"}, TDS ${tds ?? "–"} ppm, bakterier: ${bacteriaStatus}, klarhed: ${clarityStatus}`,
      createdAt: FieldValue.serverTimestamp()
    });
  }
  return { ok: true, measurementId: docRef.id, hasDeviation };
});

// ─── CLOSE WATER ALERT ───────────────────────────────────────────────────────
exports.closeWaterAlert = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId = ss(data?.companyId, 120);
  const alertId   = ss(data?.alertId, 200);
  if (!companyId || !alertId) throw new functions.https.HttpsError("invalid-argument", "Mangler parametre.");
  await assertAccess(auth.uid, companyId);
  await db.collection("water_alerts").doc(alertId).update({
    status: "resolved", resolvedBy: auth.uid, resolvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
  });
  return { ok: true };
});

// ─── RECORD WATER SERVICE ────────────────────────────────────────────────────
exports.recordWaterService = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId  = ss(data?.companyId,  120);
  const locationId = ss(data?.locationId, 120);
  const systemId   = ss(data?.systemId,   200);
  if (!companyId || !locationId || !systemId)
    throw new functions.https.HttpsError("invalid-argument", "Mangler parametre.");
  await assertAccess(auth.uid, companyId);

  const validTypes    = ["installation", "cleaning", "filter_change", "repair", "inspection", "calibration"];
  const validStatuses = ["scheduled", "in_progress", "completed", "cancelled"];
  const serviceType   = validTypes.includes(data?.serviceType)    ? data.serviceType : "inspection";
  const status        = validStatuses.includes(data?.status)      ? data.status      : "completed";

  const docRef = await db.collection("water_services").add({
    companyId, locationId, organizationId: companyId,
    systemId,
    technicianId:   ss(data?.technicianId,   120),
    technicianName: ss(data?.technicianName, 140),
    serviceType, status,
    scheduledAt:    ss(data?.scheduledAt, 80),
    completedAt:    status === "completed" ? FieldValue.serverTimestamp() : null,
    notes:          ss(data?.notes, 2000),
    photoUrls:      Array.isArray(data?.photoUrls) ? data.photoUrls.slice(0, 10).map(u => ss(u, 2000)) : [],
    partsUsed:      Array.isArray(data?.partsUsed) ? data.partsUsed.slice(0, 20).map(p => ss(p, 200)) : [],
    cost:           toMoney(data?.cost),
    dateKey:        dateKeyNow(),
    createdBy:      auth.uid,
    createdAt:      FieldValue.serverTimestamp(),
    updatedAt:      FieldValue.serverTimestamp()
  });

  const sysUpdate = { updatedAt: FieldValue.serverTimestamp() };
  if (status === "in_progress") sysUpdate.status = "service";
  else if (status === "completed") { sysUpdate.status = "active"; sysUpdate.lastServiceAt = FieldValue.serverTimestamp(); }
  await db.collection("water_systems").doc(systemId).update(sysUpdate).catch(() => {});

  return { ok: true, serviceId: docRef.id };
});

// ─── RECORD WATER PRODUCTION ─────────────────────────────────────────────────
exports.recordWaterProduction = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId  = ss(data?.companyId,  120);
  const locationId = ss(data?.locationId, 120);
  const systemId   = ss(data?.systemId,   200);
  if (!companyId || !locationId || !systemId)
    throw new functions.https.HttpsError("invalid-argument", "Mangler parametre.");
  await assertAccess(auth.uid, companyId);

  const dateKey = ss(data?.dateKey || dateKeyNow(), 30);
  const docId   = `${systemId}__prod__${dateKey}`;
  await db.collection("water_production").doc(docId).set({
    companyId, locationId, organizationId: companyId,
    systemId, dateKey,
    bottlesProduced:  toInt(data?.bottlesProduced),
    bottlesDiscarded: toInt(data?.bottlesDiscarded),
    notes:      ss(data?.notes, 1000),
    recordedBy: auth.uid,
    createdAt:  FieldValue.serverTimestamp(),
    updatedAt:  FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true, docId };
});

// ─── RECORD WATER SALES ──────────────────────────────────────────────────────
exports.recordWaterSales = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId  = ss(data?.companyId,  120);
  const locationId = ss(data?.locationId, 120);
  const systemId   = ss(data?.systemId,   200);
  if (!companyId || !locationId || !systemId)
    throw new functions.https.HttpsError("invalid-argument", "Mangler parametre.");
  await assertAccess(auth.uid, companyId);

  const dateKey        = ss(data?.dateKey || dateKeyNow(), 30);
  const bottlesSold    = toInt(data?.bottlesSold);
  const pricePerBottle = toMoney(data?.pricePerBottle);
  const revenue        = Math.round(bottlesSold * pricePerBottle * 100) / 100;
  const docId          = `${systemId}__sales__${dateKey}`;

  await db.collection("water_sales").doc(docId).set({
    companyId, locationId, organizationId: companyId,
    systemId, dateKey,
    bottlesSold, pricePerBottle, revenue,
    currency:   ss(data?.currency || "THB", 10),
    notes:      ss(data?.notes, 1000),
    recordedBy: auth.uid,
    createdAt:  FieldValue.serverTimestamp(),
    updatedAt:  FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true, docId, revenue };
});

// ─── GET DASHBOARD SUMMARY ───────────────────────────────────────────────────
exports.getWaterDashboardSummary = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId  = ss(data?.companyId,  120);
  const locationId = ss(data?.locationId, 120);
  if (!companyId || !locationId) throw new functions.https.HttpsError("invalid-argument", "Mangler parametre.");
  await assertAccess(auth.uid, companyId);

  const dateKey  = dateKeyNow();
  const monthKey = monthKeyNow();

  const [sysSn, allProdSn, allSalesSn, measSn, alertSn, svcSn] = await Promise.all([
    db.collection("water_systems"    ).where("companyId","==",companyId).where("locationId","==",locationId).get(),
    db.collection("water_production" ).where("companyId","==",companyId).where("locationId","==",locationId).get(),
    db.collection("water_sales"      ).where("companyId","==",companyId).where("locationId","==",locationId).get(),
    db.collection("water_measurements").where("companyId","==",companyId).where("locationId","==",locationId).limit(20).get(),
    db.collection("water_alerts"     ).where("companyId","==",companyId).where("locationId","==",locationId).get(),
    db.collection("water_services"   ).where("companyId","==",companyId).where("locationId","==",locationId).limit(8).get()
  ]);

  const monthStart = `${monthKey}-01`;
  const systems       = sysSn.docs.map(d => ({ id: d.id, ...d.data() }));
  const todayProduced  = allProdSn.docs.filter(d => d.data().dateKey === dateKey).reduce((s, d) => s + toInt(d.data().bottlesProduced), 0);
  const todayDiscarded = allProdSn.docs.filter(d => d.data().dateKey === dateKey).reduce((s, d) => s + toInt(d.data().bottlesDiscarded), 0);
  const todaySold      = allSalesSn.docs.filter(d => d.data().dateKey === dateKey).reduce((s, d) => s + toInt(d.data().bottlesSold), 0);
  const todayRevenue   = allSalesSn.docs.filter(d => d.data().dateKey === dateKey).reduce((s, d) => s + toMoney(d.data().revenue), 0);
  const monthProduced  = allProdSn.docs.filter(d => (d.data().dateKey || "") >= monthStart).reduce((s, d) => s + toInt(d.data().bottlesProduced), 0);
  const monthSold      = allSalesSn.docs.filter(d => (d.data().dateKey || "") >= monthStart).reduce((s, d) => s + toInt(d.data().bottlesSold), 0);
  const monthRevenue   = allSalesSn.docs.filter(d => (d.data().dateKey || "") >= monthStart).reduce((s, d) => s + toMoney(d.data().revenue), 0);
  const openAlerts     = alertSn.docs.filter(d => d.data().status === "open").length;

  const latestMeasurement = measSn.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))[0] || null;

  const recentServices = svcSn.docs.map(d => {
    const s = d.data();
    return { id: d.id, serviceType: s.serviceType, technicianName: s.technicianName || "", status: s.status, dateKey: s.dateKey, notes: (s.notes || "").slice(0, 100) };
  }).sort((a, b) => (b.dateKey || "").localeCompare(a.dateKey || "")).slice(0, 5);

  return {
    ok: true, dateKey, monthKey,
    systems: {
      total:      systems.length,
      active:     systems.filter(s => s.status === "active").length,
      inService:  systems.filter(s => s.status === "service").length,
      offline:    systems.filter(s => s.status === "offline").length,
      list:       systems.map(s => ({ id: s.id, name: s.name, systemType: s.systemType, status: s.status, installationDate: s.installationDate, roomCoverage: s.roomCoverage, location: s.location || "" }))
    },
    today:  { produced: todayProduced, discarded: todayDiscarded, sold: todaySold, revenue: todayRevenue },
    month:  { produced: monthProduced, sold: monthSold, revenue: monthRevenue },
    latestMeasurement: latestMeasurement ? {
      ph: latestMeasurement.ph, tds: latestMeasurement.tds, temperature: latestMeasurement.temperature,
      bacteriaStatus: latestMeasurement.bacteriaStatus, clarityStatus: latestMeasurement.clarityStatus,
      hasDeviation: latestMeasurement.hasDeviation, dateKey: latestMeasurement.dateKey
    } : null,
    openAlerts: openAlerts,
    recentServices
  };
});

// ─── GET CHART DATA ──────────────────────────────────────────────────────────
exports.getWaterChartData = functions.https.onCall(async (request) => {
  const { data, auth } = request;
  if (!auth?.uid) throw new functions.https.HttpsError("unauthenticated", "Log ind.");
  const companyId  = ss(data?.companyId,  120);
  const locationId = ss(data?.locationId, 120);
  if (!companyId || !locationId) throw new functions.https.HttpsError("invalid-argument", "Mangler parametre.");
  await assertAccess(auth.uid, companyId);

  const today = dateKeyNow();
  const days  = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(
      Number(today.slice(0, 4)),
      Number(today.slice(5, 7)) - 1,
      Number(today.slice(8, 10)) - i
    ));
    days.push(d.toISOString().slice(0, 10));
  }
  const from = days[0];

  const [measSn, prodSn, salesSn] = await Promise.all([
    db.collection("water_measurements").where("companyId","==",companyId).where("locationId","==",locationId).get(),
    db.collection("water_production"  ).where("companyId","==",companyId).where("locationId","==",locationId).get(),
    db.collection("water_sales"       ).where("companyId","==",companyId).where("locationId","==",locationId).get()
  ]);

  const measByDay = {};
  for (const doc of measSn.docs) {
    const m = doc.data(); const dk = m.dateKey || "";
    if (dk < from) continue;
    const ts = m.createdAt?.toMillis?.() || 0;
    if (!measByDay[dk] || ts > measByDay[dk].ts) measByDay[dk] = { ph: m.ph, tds: m.tds, temperature: m.temperature, ts };
  }
  const prodByDay = {}, salesByDay = {}, revenueByDay = {};
  for (const doc of prodSn.docs) { const p = doc.data(); const dk = p.dateKey || ""; if (dk < from) continue; prodByDay[dk] = (prodByDay[dk] || 0) + toInt(p.bottlesProduced); }
  for (const doc of salesSn.docs) { const s = doc.data(); const dk = s.dateKey || ""; if (dk < from) continue; salesByDay[dk] = (salesByDay[dk] || 0) + toInt(s.bottlesSold); revenueByDay[dk] = (revenueByDay[dk] || 0) + toMoney(s.revenue); }

  return {
    ok: true,
    labels:  days.map(d => d.slice(5)),
    quality: { ph: days.map(d => measByDay[d]?.ph ?? null), tds: days.map(d => measByDay[d]?.tds ?? null), temperature: days.map(d => measByDay[d]?.temperature ?? null) },
    volume:  { produced: days.map(d => prodByDay[d] ?? 0), sold: days.map(d => salesByDay[d] ?? 0) },
    revenue: days.map(d => revenueByDay[d] ?? 0)
  };
});

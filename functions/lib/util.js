"use strict";

// Rene hjælpefunktioner udtrukket fra index.js (ingen eksterne afhængigheder).

function toAsciiSlug(value, maxLen = 120) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLen);
}

function toLegacyId(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("onboarding_")) {
    return raw.replace(/^onboarding_/, "");
  }
  return raw;
}

function sanitizeRelativePath(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.includes("..") || raw.includes("\\")) return fallback;
  return raw;
}

function parsePageCount(value, fallback = 50) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  if (rounded < 1) return 1;
  if (rounded > 300) return 300;
  return rounded;
}

function getDateKey() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return formatter.format(now);
}

function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function daysBetween(dateKey1, dateKey2) {
  const [y1, m1, d1] = dateKey1.split("-").map(Number);
  const [y2, m2, d2] = dateKey2.split("-").map(Number);
  const date1 = new Date(Date.UTC(y1, m1 - 1, d1));
  const date2 = new Date(Date.UTC(y2, m2 - 1, d2));
  const diffMs = date2 - date1;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function getWeekdayFromDateKey(dateKey) {
  const [y, m, d] = String(dateKey || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function normalizeDateKey(value) {
  if (!value) return null;
  const str = String(value).trim();
  const match = str.match(/^(\d{4})[-_](\d{2})[-_](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function sanitizeString(value, maxLen = 500) {
  return String(value || "").trim().slice(0, maxLen);
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function sanitizeBoolean(value) {
  return value === true;
}

function sanitizeStringList(value, maxItems = 50, maxLen = 140) {
  return toArray(value)
    .map((item) => sanitizeString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function removeUndefinedFields(obj) {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => removeUndefinedFields(item)).filter(item => item !== undefined);
  }
  
  const cleaned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
  }
  return cleaned;
}

function toDocSafeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

module.exports = {
  sanitizeString,
  sanitizeStringList,
  sanitizeBoolean,
  toArray,
  toPositiveInt,
  toDocSafeId,
  toAsciiSlug,
  toLegacyId,
  getDateKey,
  addDays,
  daysBetween,
  normalizeDateKey,
  removeUndefinedFields,
  getWeekdayFromDateKey,
  sanitizeRelativePath,
  parsePageCount
};

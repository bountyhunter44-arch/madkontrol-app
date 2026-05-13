/**
 * i18n Resolver - Danish/English translation layer.
 * Backend and Firestore remain language-neutral.
 */

import da from "./da.js";
import en from "./en.js";

const translations = { da, en };
const SUPPORTED_LANGUAGES = ["da", "en"];

function normalizeLanguage(lang) {
    const normalized = String(lang || "").trim().toLowerCase().split("-")[0];
    return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : "da";
}

export function t(key, lang = "da", replacements = {}) {
    const safeLang = normalizeLanguage(lang);
    const dict = translations[safeLang] || translations.da || {};
    const fallbackDict = translations.da || {};
    const raw = dict[key] ?? fallbackDict[key] ?? null;
    if (raw === null) return null;

    let value = String(raw);
    for (const [token, tokenValue] of Object.entries(replacements)) {
        value = value.replaceAll(`{${token}}`, String(tokenValue));
    }
    return value;
}

export function tl(key, replacements = {}) {
    const lang = normalizeLanguage(localStorage.getItem("userLanguage"));
    return t(key, lang, replacements) ?? key;
}

export function getUserLanguage(profile) {
    return normalizeLanguage(
        profile?.defaultStaffLanguage ||
        profile?.language ||
        profile?.ownerLanguage ||
        "da"
    );
}

export function getAvailableLanguages() {
    return [
        { code: "da", name: "Dansk", nativeName: "Dansk" },
        { code: "en", name: "English", nativeName: "English" }
    ];
}

export function isRTL() {
    return false;
}

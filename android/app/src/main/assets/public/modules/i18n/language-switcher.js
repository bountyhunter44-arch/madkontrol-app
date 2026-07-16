/**
 * Language Switcher Component
 * Supports Danish and English only.
 */

import { getUserLanguage, getAvailableLanguages, isRTL } from "./index.js";

const SUPPORTED_LANGUAGES = ["da", "en"];

function normalizeLanguage(lang) {
    const normalized = String(lang || "").trim().toLowerCase().split("-")[0];
    return SUPPORTED_LANGUAGES.includes(normalized) ? normalized : "da";
}

export function setDocumentDirection(lang) {
    const html = document.documentElement;
    const body = document.body;
    const dir = isRTL(lang) ? "rtl" : "ltr";
    html.setAttribute("dir", dir);
    body.setAttribute("dir", dir);
}

export function saveLanguagePreference(lang) {
    localStorage.setItem("userLanguage", normalizeLanguage(lang));
}

function browserLocaleToLang(locale) {
    return normalizeLanguage(locale);
}

function detectBrowserLanguage() {
    const locales = navigator.languages || (navigator.language ? [navigator.language] : []);
    for (const locale of locales) {
        const lang = browserLocaleToLang(locale);
        if (lang !== "da" || String(locale || "").toLowerCase().startsWith("da")) return lang;
    }
    return "da";
}

export function getLanguagePreference(profile = null) {
    const stored = localStorage.getItem("userLanguage");
    if (stored) return normalizeLanguage(stored);

    if (profile) {
        return normalizeLanguage(getUserLanguage(profile));
    }

    return detectBrowserLanguage();
}

export function createLanguageSwitcher(currentLang = "da") {
    const safeLang = normalizeLanguage(currentLang);
    const languages = getAvailableLanguages();
    const currentLanguage = languages.find(l => l.code === safeLang) || languages[0];

    return `
        <div class="language-switcher">
            <button class="language-btn" id="languageBtn" aria-label="Change language">
                <span class="language-flag">${getFlagEmoji(safeLang)}</span>
                <span class="language-name">${currentLanguage.nativeName}</span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 6l4 4 4-4H4z"/>
                </svg>
            </button>
            <div class="language-dropdown" id="languageDropdown" style="display: none;">
                ${languages.map(lang => `
                    <button class="language-option ${lang.code === safeLang ? "active" : ""}" data-lang="${lang.code}">
                        <span class="language-flag">${getFlagEmoji(lang.code)}</span>
                        <span class="language-name">${lang.nativeName}</span>
                    </button>
                `).join("")}
            </div>
        </div>
    `;
}

function getFlagEmoji(lang) {
    const flags = {
        da: "DK",
        en: "EN"
    };
    return flags[lang] || "DK";
}

export function initLanguageSwitcher(profile = null) {
    const currentLang = getLanguagePreference(profile);
    setDocumentDirection(currentLang);

    let container = document.getElementById("languageSwitcherContainer");
    if (!container) {
        container = document.createElement("div");
        container.id = "languageSwitcherContainer";
        container.className = "mkp-topbar-lang";
        const topbarRight = document.querySelector(".topbar-right") || document.querySelector(".mkp-topbar-brand-row") || document.body;
        topbarRight.appendChild(container);
    }

    container.innerHTML = createLanguageSwitcher(currentLang);

    const btn = document.getElementById("languageBtn");
    const dropdown = document.getElementById("languageDropdown");

    if (btn && dropdown) {
        btn.addEventListener("click", () => {
            const isVisible = dropdown.style.display !== "none";
            dropdown.style.display = isVisible ? "none" : "block";
        });

        document.addEventListener("click", (e) => {
            if (!container.contains(e.target)) {
                dropdown.style.display = "none";
            }
        });

        dropdown.querySelectorAll(".language-option").forEach(option => {
            option.addEventListener("click", () => {
                changeLanguage(option.dataset.lang);
                dropdown.style.display = "none";
            });
        });
    }

    return currentLang;
}

export function changeLanguage(newLang) {
    saveLanguagePreference(newLang);
    setDocumentDirection(newLang);
    window.location.reload();
}

export function addLanguageSwitcherStyles() {
    if (document.getElementById("languageSwitcherStyles")) return;

    const style = document.createElement("style");
    style.id = "languageSwitcherStyles";
    style.textContent = `
        .language-switcher { position: relative; }
        .language-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: white;
            border: 1px solid #d7e2d7;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .language-btn:hover { background: #f7faf7; border-color: #2f7d32; }
        .language-flag { font-size: 12px; font-weight: 800; }
        .language-name { font-weight: 500; }
        .language-dropdown {
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 4px;
            background: white;
            border: 1px solid #d7e2d7;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            min-width: 160px;
            z-index: 999;
        }
        .language-option {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            padding: 10px 12px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 14px;
            text-align: left;
            transition: background 0.2s;
        }
        .language-option:hover { background: #f7faf7; }
        .language-option.active { background: #eaf6eb; font-weight: 600; }
    `;

    document.head.appendChild(style);
}

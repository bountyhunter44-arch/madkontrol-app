/**
 * Central i18n initialization and utilities
 * Wraps the existing i18n module with page translation capabilities
 */

import { t as translate, tl, getUserLanguage, getAvailableLanguages, isRTL } from '/modules/i18n/index.js';
import { 
    initLanguageSwitcher, 
    getLanguagePreference, 
    setDocumentDirection,
    saveLanguagePreference,
    changeLanguage,
    addLanguageSwitcherStyles
} from '/modules/i18n/language-switcher.js';

let currentLanguage = 'da';
let isInitialized = false;

/**
 * Initialize i18n system
 */
export async function initI18n(profile = null) {
    if (isInitialized) return currentLanguage;
    
    // Get language preference
    currentLanguage = getLanguagePreference(profile);
    
    // Set document direction
    setDocumentDirection(currentLanguage);
    
    // Add switcher styles
    addLanguageSwitcherStyles();
    
    // Initialize language switcher
    initLanguageSwitcher(profile);
    
    // Translate page
    translatePage();
    
    isInitialized = true;
    return currentLanguage;
}

/**
 * Translate all elements with data-i18n attributes
 */
export function translatePage() {
    const lang = localStorage.getItem('userLanguage') || 'da';
    
    // Translate text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const translated = translate(key, lang);
        if (translated) {
            el.textContent = translated;
        }
    });
    
    // Translate HTML content
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
        const key = el.getAttribute('data-i18n-html');
        const translated = translate(key, lang);
        if (translated) {
            el.innerHTML = translated;
        }
    });
    
    // Translate placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        const translated = translate(key, lang);
        if (translated) {
            el.placeholder = translated;
        }
    });
    
    // Translate titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        const translated = translate(key, lang);
        if (translated) {
            el.title = translated;
        }
    });
    
    // Translate aria-labels
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        const key = el.getAttribute('data-i18n-aria-label');
        const translated = translate(key, lang);
        if (translated) {
            el.setAttribute('aria-label', translated);
        }
    });
}

/**
 * Translate a key with current language
 */
export function t(key, replacements = {}) {
    return tl(key, replacements);
}

/**
 * Set language and reload page
 */
export function setLanguage(lang) {
    changeLanguage(lang);
}

/**
 * Get current language
 */
export function getCurrentLanguage() {
    return localStorage.getItem('userLanguage') || 'da';
}

// Re-export utilities
export { 
    getUserLanguage, 
    getAvailableLanguages, 
    isRTL,
    saveLanguagePreference,
    setDocumentDirection
};

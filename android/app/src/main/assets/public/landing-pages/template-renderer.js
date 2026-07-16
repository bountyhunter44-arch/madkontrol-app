/**
 * Runtime Template Renderer for Landing Pages
 * Replaces {{key}} placeholders with values from data-config
 * Works in text nodes and attributes
 */
(function() {
    'use strict';

    function renderTemplate() {
        // Get config from body data-config attribute
        const configAttr = document.body.getAttribute('data-config');
        if (!configAttr) {
            console.warn('No data-config found on body element');
            return;
        }

        let config;
        try {
            config = JSON.parse(configAttr);
        } catch (e) {
            console.error('Failed to parse data-config:', e);
            return;
        }

        // Regex to match {{key}}
        const placeholderRegex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;

        // Replace function
        function replacePlaceholders(text) {
            return text.replace(placeholderRegex, function(match, key) {
                return config[key] !== undefined ? config[key] : '';
            });
        }

        // Walk through all text nodes and replace
        function walkTextNodes(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                const originalText = node.nodeValue;
                if (originalText && placeholderRegex.test(originalText)) {
                    node.nodeValue = replacePlaceholders(originalText);
                }
                // Reset regex lastIndex
                placeholderRegex.lastIndex = 0;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Replace in attributes
                if (node.hasAttributes()) {
                    const attrs = node.attributes;
                    for (let i = 0; i < attrs.length; i++) {
                        const attr = attrs[i];
                        if (placeholderRegex.test(attr.value)) {
                            attr.value = replacePlaceholders(attr.value);
                            placeholderRegex.lastIndex = 0;
                        }
                    }
                }
                // Recurse into child nodes
                const children = node.childNodes;
                for (let i = 0; i < children.length; i++) {
                    walkTextNodes(children[i]);
                }
            }
        }

        // Start walking from body
        walkTextNodes(document.body);
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderTemplate);
    } else {
        // DOM already loaded
        renderTemplate();
    }
})();

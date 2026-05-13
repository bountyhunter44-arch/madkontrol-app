# i18n System

## Sprog

- Dansk (`da`) - default og fallback
- English (`en`)

## Struktur

```
/modules/i18n/
├── index.js
├── da.js
├── en.js
├── language-switcher.js
├── rtl.css
└── README.md
```

`rtl.css` er bevaret som kompatibilitetsfil, men der er ikke længere RTL-sprog i sprogvælgeren.

## Brug

```js
import { t } from "/modules/i18n/index.js";

t("layout.label.company", "da"); // Virksomhed:
t("layout.label.company", "en"); // Company:
t("layout.label.company", "de"); // Virksomhed:
```

Fallback er altid dansk.

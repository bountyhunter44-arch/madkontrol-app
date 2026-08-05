# i18n Integration Guide

Systemet understøtter kun:

- Dansk (`da`)
- English (`en`)

Prioritet:

1. `localStorage.userLanguage`
2. brugerprofilens sprogfelter
3. browserens sprog, hvis det er `da` eller `en`
4. dansk fallback

Alle andre sprogkoder normaliseres til `da`.

```js
window.i18n.t("common.save"); // bruger aktuelt sprog
```

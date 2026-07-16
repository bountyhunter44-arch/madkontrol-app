import { resolvePlatformContext } from "../../../platform/context-provider.js";
import { getAppAccess } from "../../../platform/entitlement-client.js";
import { platformEmit } from "../../../platform/event-bus.js";
import { connectMenuEventListeners, mountMenuApp, reloadMenuData, updateMenuAppState } from "./app-shell.js";
import { createBlankCategory, createBlankMenuItem, getRelatedAppViewModels, loadMenuAppConfig } from "./service.js";

async function bootMenuApp() {
  const root = document.getElementById("menuAppRoot");
  if (!root) throw new Error("Menu app root not found");

  root.innerHTML = `
    <section class="menu-card menu-loading">
      <h1>Menu & Retter</h1>
      <p>Henter virksomhed, lokation og menukort.</p>
    </section>
  `;

  const debug = new URLSearchParams(window.location.search).get("debug") === "1";
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "order" ? "order" : "admin";
  const portalMode = params.get("portal") === "delefragt";
  const [appConfig, context] = await Promise.all([
    loadMenuAppConfig(),
    resolvePlatformContext({ sourceApp: "menu" })
  ]);
  const access = getAppAccess("menu", context);
  const relatedApps = getRelatedAppViewModels(context, appConfig.relatedApps || []);

  updateMenuAppState({
    appConfig,
    context,
    access,
    debug,
    mode,
    portalMode,
    relatedApps,
    categoryDraft: createBlankCategory(context),
    itemDraft: createBlankMenuItem(context)
  });
  connectMenuEventListeners(root);
  mountMenuApp(root);
  platformEmit("app:ready", { appKey: "menu", context });
  await reloadMenuData(root);
}

bootMenuApp().catch((error) => {
  const root = document.getElementById("menuAppRoot");
  if (root) {
    root.innerHTML = `
      <section class="menu-card menu-empty-state">
        <h1>Menu & Retter kunne ikke starte</h1>
        <p>${String(error?.message || error)}</p>
      </section>
    `;
  }
  console.error("[menu-app] boot failed", error);
});

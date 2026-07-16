# Menu & Retter Verification

Run this before treating Menu as ready for the next module.

## Scope

- Admin route: `/apps/menu/index.html`
- Order route: `/apps/menu/index.html?mode=order`
- Portal order route: `/apps/menu/index.html?mode=order&portal=delefragt`

## Dependencies

Allowed:

- `public/platform/context-provider.js`
- `public/platform/firebase-client.js`
- `public/platform/entitlement-client.js`
- `public/platform/event-bus.js`
- `public/platform/app-launcher.js`
- `public/platform/app-registry.js`

Forbidden:

- Core layout/sidebar/header imports
- Drift demo scripts
- Madkontrollen Core business logic

## Syntax

```bash
node --check public/apps/menu/src/main.js
node --check public/apps/menu/src/state.js
node --check public/apps/menu/src/service.js
node --check public/apps/menu/src/app-shell.js
node --check public/apps/menu/src/render.js
node --check public/apps/menu/src/contracts.js
```

## Smoke Tests

- Open admin route.
- Confirm no raw context JSON appears without `?debug=1`.
- Create category.
- Create menu item.
- Edit menu item.
- Toggle active/inactive.
- Create add-on group.
- Create add-on.
- Link add-on group to menu item.
- Open order route.
- Add item with add-ons to cart.
- Confirm subtotal.
- Remove cart line.
- Set portal enrollment to `draft`.
- Set portal enrollment to `pending_review`.
- Test 390px mobile width.

## Firestore Scope

All documents must include:

- `companyId`
- `locationId`

Collections:

- `menu_categories`
- `menu_items`
- `menu_addon_groups`
- `menu_addons`
- `portal_enrollments`

## Deploy

Frontend only:

```bash
firebase deploy --only hosting
```

## Last Verification

Fill in after each checkpoint:

- Date:
- Commit:
- Commands run:
- Smoke-test result:
- Deploy:
- Warnings:

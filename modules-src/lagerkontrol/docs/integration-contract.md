# Lagerkontrol Integration Contract

Status: staging contract.

## Principle

Lagerkontrol may integrate with other Madkontrollen products through APIs, read models and events. It must not import other modules' runtime files directly.

## POS -> Lagerkontrol

POS may publish:

- `pos.sale.completed`
- `pos.sale.refunded`
- `pos.stockReservation.created`

Lagerkontrol may consume those events to reduce stock or reserve quantities. POS must not write directly to `inventory_items`.

## Lagerkontrol -> Bogføring

Lagerkontrol may publish supplier document events:

- `lagerkontrol.supplierDocument.uploaded`
- `lagerkontrol.supplierDocument.readyForBooking`
- `lagerkontrol.goods.received`

Bogføringsappen may consume these to create posting drafts. Lagerkontrol must not mark accounting records booked without Bogføringsappen's contract.

## Lagerkontrol -> Menu/Opskrifter

Menu/Opskrifter may read cost data through:

- `getCostPrice`
- `menu_cost_profiles`
- future `lagerkontrol.cost.updated` events

Menu must not read private supplier documents directly.

## Lagerkontrol -> Kalkulation

Kalkulation may consume cost price, waste percentage and price indexes to calculate margin and recommended sales price.

Integration should be read-only unless a separate pricing-write contract is created.

## Lagerkontrol -> Egenkontrol

Egenkontrol integration is API/event only.

Allowed:

- goods receipt HACCP metadata exposed as documented event/API
- read-only references to receipt documentation

Not allowed:

- direct imports from `public/modules/egenkontrol`
- direct writes to Egenkontrol task/routine history
- requiring Egenkontrol as a base module

## Platform

Platform provides:

- auth
- company/location context
- entitlements
- launcher
- module registry

Lagerkontrol should depend on a platform adapter, not on scattered global state.

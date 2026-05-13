# PolicyBridge AI Podcast Station

PolicyBridge AI Podcast Station is a planning package for an AI-native podcast and debate platform. This folder contains only structure, registries, workflows, and architecture documentation. It intentionally contains no backend implementation, realtime voice stack, auth integration, payment flow, deployment configuration, or production runtime code.

## Purpose

The platform should help people think more deeply together. AI participants must support inquiry, synthesis, memory, and reflection without presenting themselves as all-knowing authorities.

Core product goals:

- Human plus AI debate formats.
- AI summaries that preserve disagreement and uncertainty.
- Compromise detection across participants and policies.
- Overlap analysis between positions, evidence, values, and constraints.
- Realtime knowledge synthesis as a future capability.
- Conversational realism without deceptive personhood.
- Transparent uncertainty and source limitations.
- Public trust architecture for moderation, provenance, and auditability.

## Directory Map

- `registries/`: module, AI profile, workflow, dependency, and protected-boundary registries.
- `docs/`: architecture, moderation, debate, synthesis, transparency, and trust documentation.
- `workflows/`: design-time workflows for future feature development.
- `profiles/`: AI participant profile definitions and behavioral constraints.

## Non-Goals For This Phase

- No backend logic.
- No realtime voice.
- No authentication or payment changes.
- No Firestore rules or schema writes.
- No deployment changes.
- No production task engine changes.

## Ownership

This folder owns conceptual design and future implementation contracts for the PolicyBridge AI Podcast Station. It does not own any production Madkontrollen runtime system.

## Protected Systems

Do not touch these systems from this package without explicit future approval:

- Stripe.
- Auth.
- Firestore rules.
- Onboarding.
- Payment flow.
- `live_user_profiles`.
- Production task engine.


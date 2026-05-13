# Module Ownership

## Current Ownership

This folder owns planning artifacts for PolicyBridge AI Podcast Station:

- Registries.
- Architecture docs.
- Workflow docs.
- AI profile definitions.
- Moderation principles.
- Debate rules.
- Synthesis concepts.
- Public transparency rules.

## Current Non-Ownership

This folder does not own:

- Existing Madkontrollen UI.
- Firebase Functions.
- Firestore schema or rules.
- Auth.
- Stripe.
- Onboarding.
- Payment flow.
- `live_user_profiles`.
- Production task engine.
- Hosting deploy configuration.

## Future Ownership Boundaries

Future runtime modules should preserve these boundaries:

- Session orchestration should not own billing or identity.
- AI profiles should not own moderation enforcement.
- Moderation labels should not own public summaries.
- Public summaries should not overwrite raw transcripts.
- Transparency ledger should not expose private data.


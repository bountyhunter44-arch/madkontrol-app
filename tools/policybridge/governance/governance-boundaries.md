# Governance Boundaries

## Hard Boundary

PolicyBridge must help people understand policy choices. It must not manipulate voters, hide partisan assumptions, or present AI output as absolute truth.

## Protected Systems

Do not touch:

- Stripe.
- Auth.
- Firestore rules.
- Onboarding.
- Payment flow.
- `live_user_profiles`.
- Production task engine.
- Deployment pipelines.

## Required Before Runtime

Future runtime work requires:

- Source policy.
- Neutrality policy.
- Uncertainty model.
- Public explanation review.
- Human review path for high-impact topics.
- Data retention and privacy review.
- Explicit approval for backend or deployment changes.

## Raw vs Derived Data

Future implementation must keep separate:

- Raw policy text.
- Source metadata.
- Parsed policy fields.
- AI analysis.
- Scenario outputs.
- Public summaries.
- Human edits.
- Corrections.


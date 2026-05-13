# Architecture Concept

## Status

Planning only. This document describes future architecture concepts without implementing runtime logic.

## Architectural Principle

PolicyBridge should be a thinking environment, not an answer machine. AI systems may help map claims, clarify disagreement, and draft summaries, but they must not behave as final authorities.

## Conceptual Layers

### 1. Session Layer

Future responsibility:

- Create a debate or podcast session.
- Define topic, participants, format, and consent constraints.
- Identify whether the session is exploratory, adversarial, deliberative, or public-facing.

No implementation in this phase.

### 2. Participant Layer

Future responsibility:

- Represent humans, AI assistants, moderators, and observers.
- Show AI role labels clearly.
- Enforce that AI profiles declare limits and uncertainty.

### 3. Debate Flow Layer

Future responsibility:

- Manage turns.
- Track claims, questions, rebuttals, evidence, and values.
- Prevent one participant from monopolizing the conversation.
- Preserve unresolved disagreement.

### 4. Knowledge Synthesis Layer

Future responsibility:

- Summarize the conversation at checkpoints.
- Separate evidence from interpretation.
- Detect overlap between positions.
- Identify compromise candidates.
- Track missing information.

### 5. Moderation Layer

Future responsibility:

- Apply debate rules.
- Mark abusive, manipulative, or bad-faith patterns.
- Escalate unclear cases to human moderators.
- Avoid viewpoint suppression based only on disagreement.

### 6. Public Transparency Layer

Future responsibility:

- Publish AI roles and methods.
- Explain summary limitations.
- Show corrections.
- Label confidence and uncertainty.
- Record when AI influenced a synthesis.

## Future Data Boundaries

Raw material and derived material must remain separate:

- Raw transcript.
- Speaker turns.
- Claims.
- Evidence references.
- AI analysis.
- Summary drafts.
- Published summaries.
- Moderation actions.
- Corrections.

## Module Ownership

- Debate Room owns visible conversation flow.
- AI Participant Orchestrator owns profile selection and profile boundaries.
- Synthesis Engine owns structured summaries and overlap analysis.
- Moderation Layer owns rules and escalation.
- Public Transparency Ledger owns public explainability and correction history.

## Explicit Non-Ownership

This package does not own auth, billing, onboarding, Firestore rules, deployment, or existing Madkontrollen production systems.


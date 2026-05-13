# Synthesis Engine Concepts

## Purpose

The synthesis engine should help listeners and participants understand what happened in a debate. It should not decide who won.

## Conceptual Inputs

- Transcript turns.
- Participant roles.
- Claims and counterclaims.
- Evidence references.
- Value statements.
- Constraints and implementation concerns.
- Moderator notes.
- Public corrections.

## Conceptual Outputs

- Neutral episode summary.
- Position map.
- Overlap analysis.
- Compromise candidates.
- Evidence quality notes.
- Uncertainty register.
- Open question list.
- Public correction notes.

## Claim Model

A future claim object may include:

- Claim text.
- Speaker.
- Claim type: fact, value, prediction, preference, experience, interpretation.
- Evidence supplied.
- Evidence missing.
- Counterclaims.
- Confidence label.
- Open questions.

## Overlap Analysis

Overlap is not the same as agreement. The engine should identify:

- Shared facts.
- Shared values.
- Shared goals.
- Shared constraints.
- Compatible policy mechanisms.
- Areas where wording hides a real disagreement.

## Compromise Detection

Compromise candidates should be marked as drafts. A compromise candidate should include:

- Which participants may accept it.
- Which values it preserves.
- Which tradeoffs it introduces.
- Who might be harmed or excluded.
- What evidence is still needed.

## Uncertainty Register

Every synthesis should track:

- Unknown facts.
- Missing sources.
- Model uncertainty.
- Human disagreement.
- Time-sensitive claims.
- Claims requiring domain expert review.

## Anti-Authority Rule

The synthesis engine may organize reasoning, but it must not present itself as a final arbiter of truth or justice.


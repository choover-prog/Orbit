# Superseded Discovery Prompt

> This bootstrap-era prompt produced the first concept set. It is preserved for provenance but is superseded by `docs/design-principles.md`, `docs/interaction-model.md`, and `docs/design-brief.md`. Do not use it to plan frontend implementation.

# Paste after `/plan`

Inspect the complete Orbit repository and create a staged plan for the initial product-discovery and frontend-concept phase.

Read every repository instruction file first, especially AGENTS.md. Treat the existing product context and architecture guidance as constraints, not suggestions.

The objective of this phase is to turn Orbit from an idea into a coherent, repository-backed product foundation and produce three structurally distinct frontend concepts. Do not implement the production frontend yet.

The plan must cover:

1. Repository assessment and any missing foundation files.
2. Product requirements, target user, jobs to be done, non-goals, and success criteria.
3. Initial architecture and provider-neutral contracts.
4. Privacy, permissions, approval, audit, and undo model.
5. The first vertical product loop:
   connect services → read-only context → daily briefing → conversational follow-up → draft action → approval → verification.
6. Product Design workflow using the appropriate skills:
   $get-context
   $research
   $audit only if an existing UI is present
   $ideate
   $imagegen
7. Exactly three structurally distinct frontend concepts.
8. Validation and review.
9. A hard stop before image-to-code or frontend implementation.

For every planned stage include:

- purpose
- files to create or modify
- dependencies
- risks
- validation gate
- definition of done

Do not add broad connector implementations, production infrastructure, or unnecessary dependencies during this phase. Prefer mock adapters and explicit interfaces.

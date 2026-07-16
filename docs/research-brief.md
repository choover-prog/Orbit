# UX Research Brief

## Scope

This July 2026 scan examines current user friction around personal AI assistants for nontechnical adults: onboarding, cross-service context, proactive value, privacy, action control, and voice-assistant trust. Orbit does not yet have users, so the evidence comes from adjacent products, academic research, and public user discussions. Anecdotes indicate hypotheses, not prevalence.

## Executive read

The strongest unmet need is not another general chat surface; it is coordinated help across email, calendar, tasks, and notes without technical setup. Public discussions repeatedly pair enthusiasm for a concise daily brief with frustration about DIY APIs and workflow configuration. The same discussions show that broader context access immediately raises concerns about storage, reliability, and unintended action. Voice-assistant research likewise connects adoption to perceived usefulness, transparency, privacy, and control. Orbit should therefore earn trust progressively: deliver read-only value first, make evidence visible, request narrow capabilities only when needed, and show an explicit action lifecycle through verification and recovery.

## Ranked problems

### 1. Setup cost blocks ordinary users

- User goal: connect familiar services without becoming an integrator.
- Break: APIs, credentials, workflow tools, and ambiguous connection steps shift product work onto the user.
- Evidence: public users describe DIY setup as painful for nontechnical people while valuing assistants that combine memory with calendar and email context ([Reddit discussion](https://www.reddit.com/r/Adulting/comments/1r4igji/finally_set_up_a_personal_ai_assistant_and_its/)).
- Severity: high. Frequency signal: repeated anecdotal signal. Confidence: medium.
- Product move: phone-like onboarding, provider-hosted authorization, sensible read-only defaults, and no exposed infrastructure.

### 2. Context must become a focused outcome

- User goal: know what matters without searching several apps or inventing prompts.
- Break: isolated tools and passive chat interfaces leave prioritization to the user.
- Evidence: users describe demand for one morning brief spanning email, calendar, and tasks ([Reddit example](https://www.reddit.com/r/AgenticWorkers/comments/1s1o4ou/building_a_personal_ai_assistant_in_5_mins/)); others ask for proactive pattern detection with a proposal before scheduling ([Reddit example](https://www.reddit.com/r/AIPersonalAssistant/comments/1t1wo9v/how_to_turn_your_ai_into_a_personal_assistant/)).
- Severity: high. Frequency signal: repeated anecdotal signal. Confidence: medium.
- Product move: bring one timely concern into attention, keep additional concerns conversationally available, expose source evidence on demand, and support quick follow-up.

### 3. Personal access creates a trust threshold

- User goal: receive personalized help without losing control of sensitive information.
- Break: email, calendar, health, and home access feels disproportionate when purpose, retention, and provider behavior are unclear.
- Evidence: public discussions identify privacy and reliability as core reasons personal assistants fail to earn sustained use ([Reddit discussion](https://www.reddit.com/r/AI_Agents/comments/1nw8k5o/tons_of_ai_personal_assistants_being_built_why/)). Research on smart-speaker privacy finds meaningful differences in user preferences and trust across manufacturers ([Computers & Security study](https://www.sciencedirect.com/science/article/pii/S0167404824006084)).
- Severity: critical. Frequency signal: broad research plus anecdotal signal. Confidence: high.
- Product move: purpose-specific access, clear retention, visible freshness, scoped revocation, and health-specific limits.

### 4. Action reliability needs visible control and recovery

- User goal: delegate routine work without accidental side effects.
- Break: automation demos jump from interpretation to execution and conceal changed inputs, partial failures, or weak verification.
- Evidence: public builders explicitly recommend beginning email and calendar assistants in read-only or proposal mode ([Reddit discussion](https://www.reddit.com/r/AiBuilders/comments/1t1wsti/how_to_turn_your_ai_into_a_personal_assistant/)). Research links voice-assistant failures to changing user trust ([arXiv study](https://arxiv.org/abs/2303.00164)).
- Severity: critical. Frequency signal: research plus practitioner signal. Confidence: high.
- Product move: immutable reviewed plans, deterministic approval policy, idempotency, provider readback, audit, and qualified undo.

### 5. Privacy controls must be understandable, not merely available

- User goal: understand and change what the assistant knows and can do.
- Break: privacy controls become legal text or scattered settings.
- Evidence: an 80-participant study evaluated simplified dashboards for managing voice-assistant data and privacy preferences ([USENIX Security](https://www.usenix.org/conference/usenixsecurity22/presentation/sharma-vandit)).
- Severity: high. Frequency signal: empirical but bounded. Confidence: medium-high.
- Product move: capability-level controls, plain-language summaries, connection status, activity history, and one clear revocation path.

## Opportunity map

### First prototype

- Resting and single-concern attention states with evidence and freshness on demand.
- Read-only connection education.
- One transparent draft-to-verify action lifecycle.
- Connection and capability controls in plain language.

### Product validation quarter

- Moderated onboarding and approval comprehension studies.
- Household permission research.
- Voice privacy cues and interruption preference testing.
- Correction and false-positive recovery workflows.

### Needs deeper research

- Retention expectations by domain.
- Health-context boundaries and escalation language.
- Consent when one person's data implies information about another.
- Trust repair after failed or partially completed actions.

## Source limitations

Reddit posts are self-selected anecdotes and may overrepresent builders and enthusiasts. Academic studies often focus on smart speakers rather than cross-domain orchestration. No internal customer, support, or usage data exists yet. Claims above distinguish this evidence from product inference and should be validated with interviews and prototype studies.

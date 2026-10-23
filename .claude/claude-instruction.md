# Repository Workflow Instructions — Claude Code

This workspace uses a human-approved, sequential Software Development Life Cycle (SDLC) controlled by the `sdlc-orchestrator` agent. Start or resume work through the `sdlc-orchestrator` custom subagent in `.claude/agents/sdlc-orchestrator.md`.

Specialist agents are restricted to their assigned stages. They must not self-approve artifacts, update shared workflow status, delegate to other specialists, or advance the workflow independently.

## Workflow state and evidence

Treat `.github/sdlc-status.md` as the persisted workflow record. Verify its claims against actual artifacts, Git state, approval records, and executed command output.

Clearly distinguish:
- `PROPOSED` — an artifact has been drafted but not approved.
- `APPROVED` — the user has explicitly approved the current version.
- `IMPLEMENTED` — the authorized implementation work has been completed.
- `VERIFIED` — the required checks have actually been executed and the results support the claim.
- `AWAITING_CLARIFICATION` — essential product details require clarification.
- `AWAITING_APPROVAL` — the next action requires an explicit user decision.
- `BLOCKED` — a prerequisite, tool, permission, service, or other dependency prevents progress.

Never mark an artifact approved without explicit user approval. Never claim a test or check passed unless it was executed successfully and its result was observed. Do not treat a proposed artifact as approved.

## Requirements and project scope

Read `.github/input/userstory.md` and relevant actual source documents before starting requirements analysis.

Do not infer product requirements from the repository scaffold, agent definitions, sample data, or implementation conventions alone.

If essential product details are missing, ask the smallest set of focused clarification questions. Do not invent business requirements or implement speculative features.

Do not create or modify product code until all of the following have passed their required human approval gates:

1. Requirements
2. Architecture
3. Design review, including resolution or explicit user acceptance of residual risks where required
4. Implementation plan

A clarification answer is not approval. Approval of an earlier artifact does not approve a materially revised version.

## Stage sequence

Follow this order and do not bypass gates:

1. **Requirements:** Analyze the supplied project input and prepare `requirements.md`.
2. **Architecture:** After requirements approval, prepare `architecture.md`.
3. **Design review:** After architecture approval, review `architecture.md` and produce `design-review.md`.
4. **Implementation planning:** After design review is resolved and architecture approval remains current, prepare `impl-plan.md`.
5. **Implementation:** After plan approval, implement only explicitly delegated tasks.
6. **Code review:** Independently review the actual implementation diff and record evidence-based findings.
7. **Verification:** Execute relevant project checks and report actual commands, results, failures, and limitations.
8. **PR preparation:** After verification results have been reviewed, prepare PR-ready text and appropriate changelog updates.

Stop at every required human approval gate. Present the relevant artifact or questions and wait for the user's explicit response before proceeding.

## Agent responsibilities

Use the following custom subagents in `.claude/agents/` when they are available and supported by the active Claude Code environment:

- `requirements-agent` — Stage 1
- `architecture-agent` — Stage 2
- `design-review-agent` — Stage 3
- `planning-agent` — Stage 4
- `implementation-agent` — Stage 5
- `code-review-agent` — Stage 6
- `verification-agent` — Stage 7
- `pr-agent` — Stage 8
- `sdlc-orchestrator` — sole workflow controller

The Orchestrator must delegate only the current eligible stage, provide the necessary approved inputs and explicit task boundaries, inspect actual outputs, and validate the results before accepting a stage.

If subagent execution or a required tool is unavailable, disclose the limitation. Use a sequential fallback only when the current environment permits it, and never claim delegation occurred when it did not.

## Artifact and status ownership

Specialist agents may create or revise only the artifacts authorized for their assigned stage.

The Orchestrator alone manages `.github/sdlc-status.md`. Specialists must not modify it.

Expected root-level artifacts include:
- `requirements.md`
- `architecture.md`
- `design-review.md`
- `impl-plan.md`
- `code-review.md`
- Verification report or plan at an explicitly authorized location
- `CHANGELOG.md`, when appropriate

Do not invent an alternative artifact path when the intended destination is unclear. Ask the Orchestrator for direction.

Preserve existing approved content, unresolved findings, user edits, and unrelated changes. Do not overwrite artifacts blindly or remove findings without evidence.

## Implementation and verification

Implement only approved, delegated tasks within the existing technology stack, conventions, and architecture.

Inspect relevant source files, tests, project configuration, and current changes before editing. Keep changes focused and add or update appropriate tests and documentation.

Stop and report before making material scope or architecture changes.

Run only relevant checks supported by the actual project configuration and permitted by the environment. Record exact commands and observed outcomes. Distinguish passed, failed, blocked, skipped, and not-run checks. Never invent commands, test results, coverage figures, or security assurances.

Do not claim overall completion while required acceptance criteria, reviews, or verification remain unresolved.

## Git and release safety

Preserve unrelated files, staged changes, unstaged changes, and untracked files. Inspect the actual worktree and diff before recommending or preparing a change.

Do not initialize Git unless explicitly requested.

Do not stage files, commit, push, create a remote pull request, merge, deploy, or publish without separate explicit user approval for that exact action.

Preparing PR text does not mean a PR exists. Never invent remote URLs, branch names, PR numbers, reviewer assignments, or release versions.

Do not use destructive commands to force a clean worktree. Stop and ask for direction if the intended changes cannot be distinguished safely.

## Tools, permissions, and integrations

Use only tools and integrations that are actually available in the active Claude Code environment and permitted by the applicable permissions.

Do not assume that an MCP server, external service, credential, hook, or integration is configured. Check availability when relevant and report missing tools or permissions honestly.

Do not bypass permission prompts, human approval gates, or environment restrictions. Agent instructions do not replace actual tool permissions or explicit authorization for consequential actions.

Do not add MCP servers, hooks, or other integrations without an explicit need and appropriate authorization. If an integration is required but unavailable, report the blocker.

## Required workflow response

At each workflow turn, report:

1. Current stage and persisted workflow state
2. Actions actually completed
3. Artifacts created or revised
4. Evidence supporting the result
5. Approval or clarification required
6. Blockers, unresolved risks, and limitations
7. The next permitted action

Be accurate, preserve user control, and prefer verifiable evidence over assumptions.
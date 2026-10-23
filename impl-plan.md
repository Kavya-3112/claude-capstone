# Implementation Plan - Contact Management System

**Status: APPROVED by the user on 2026-10-22 for the start of Stage 5 (tasks T-00 to T-05 and later tasks in order), recorded here by the main session on their behalf, not by the SDLC orchestrator.** The user replied "record plan approval" in the main Claude Code session after being shown the plan summary and told the orchestrator had not verified any approval. Recorded decisions, accepted by the user as proposed: (1) the 100/20 length limits are counted in code points; (2) a phone search query with no digits matches no phones; (3) a `+` is rejected anywhere except the start of a phone. Tasks T-02, T-03 and T-05 must cite these. Not decided and still open: search during recovery, the staleness baseline when storage was unavailable at load, the leftover-backup ordering and step 3 wording (DR-01), Q-08, Q-15, hosting, and acceptance of DR-10 and the LOW findings as residual risk. Task statuses may be updated by the implementation agent as work proceeds. Every task is NOT_STARTED at the time of this approval.

**Further decisions, recorded 2026-10-22 by the main session after the user replied "i approve go ahead" to a message offering "recommended" answers and the start of T-06 to T-10:** (4) DR-01: a leftover backup key found at startup is handled first (offer restore or discard); any new corruption is handled afterwards. (5) DR-02: if storage was unavailable at load, the staleness baseline is empty and the user is warned before the first successful write. T-06 to T-10 may start on that basis.

**Further decisions, recorded 2026-10-22 by the main session after the user replied "i approve go ahead" to a message asking for "recommended" plus a yes/no on the restore reading before starting T-11 to T-13:** (6) Restoring a leftover backup writes its raw value to the contacts key and then removes the backup, as implemented in T-10; the caller reloads afterwards. (7) Search stays read-only and usable during recovery, since it cannot change data. T-11 to T-13 may start on that basis. The user was also offered an independent code review of T-00 to T-10 before the UI work and did not request it.

**Further decisions, recorded 2026-10-22 by the main session after the user replied "i approve go ahead" to a message asking for "recommended" answers on code-review.md (T-00..T-13, reviewed under a user gate override):** (8) Fix CR-01, CR-02, CR-03 and the quick LOW items (CR-06, CR-07, CR-11) before T-14; CR-08 and CR-09 ride with the UI tasks. (9) Add a build-only meta CSP now (CR-04), not at T-24; hosting stays undecided. (10) Restoring a leftover backup must not overwrite data that changed since load unless the user explicitly confirms; this refines decision 6. (11) Edits stay blocked while a tab is stale, until the user reloads. CR-05 stays documented as the accepted two-tab residual risk.

**Further decisions, recorded 2026-10-22 by the main session after the user replied "i approve go ahead" to a message asking for "recommended" before starting T-14 to T-17:** (12) Decision 10 stays as implemented ("changed since load"); the stricter review reading is not adopted. (13) T-14 to T-17 (list, add, edit, delete) may start. The implementation agent chooses plain, short English wording for messages and dialogs and must list every user-facing string in its report for the user's review; wording is not approved by this entry. CR-10 (`tabindex="-1"` on `#main`, banner region announcement strategy) is done as part of these tasks.

**Further decision, recorded 2026-10-22 by the main session after the user replied "i approve go ahead" to a message asking for "recommended" before starting T-18 and T-19:** (14) T-18 (search) and T-19 (save banner with Retry) may start. The implementation agent again chooses plain, short English wording and lists every new user-facing string in its report; wording is not approved by this entry. The T-14..T-17 wording was shown to the user, who did not request changes; that is not an approval of it either.

**Further decisions, recorded 2026-10-22 by the main session after the user replied "record" to a message asking for "recommended" plus a yes/no on the memory-only retry reading before starting T-20 and T-21. The one-word reply was read as accepting the proposals as written; the user should correct this entry if that was not meant:** (15) The memory-only "Test storage again" reading of decision 5 is accepted as implemented in T-19 (clicking acknowledges the warning, then tries a save; refused as stale if data has appeared). (16) A contact being edited stays visible even if a search would hide it, until the edit ends; focus after a successful Retry goes to the list heading. (17) T-20 (recovery screen) and T-21 (multi-tab warning, "Keep editing" / "Reload and discard") may start. The implementation agent drafts plain English wording for recovery, restore, download/copy and the "I have my own copy" confirmation, and lists every string for the user's review; wording is not approved by this entry.

**Further decisions, recorded 2026-10-22 by the main session after the user replied "i approve go ahead" to a message asking for "recommended" on the built-in `/code-review` of `src/` (not the SDLC Stage 6 review; no SDLC gate is cleared by it):** (18) Fix review items 1-4 and 8 (stale Copy/Download keys in recoveryModel.ts; discarding a draft when Edit is clicked on another row; focus after the recovery panel disappears; blocked Edit/Delete/Add controls must be disabled with a visible reason, settling the earlier open question), plus items 5-7 if cheap (stale "left" step, backup-key storage events in tabs.ts, single set() in store load paths). Item 3 (record without `createdAt` silently rewritten): send such records to recovery or preserve the field, do not rewrite silently. The two duplication cleanups wait until the remaining tasks are done. Each fix gets a test. Still open: search during recovery, the exact wording of step 3 of backup-then-replace (it follows the architecture as written), Q-08, Q-15, hosting, and acceptance of DR-10 and the LOW findings as residual risk.

> **BANNER - this plan rests on unverified approvals and was produced under a user gate override.**
> - The approval lines in `requirements.md` and `architecture.md` (2026-10-22) were written by the main session on the user's behalf, not by the SDLC orchestrator. I have not verified them.
> - `.github/sdlc-status.md` does not exist, so there is no orchestrator record of any approval.
> - `design-review.md` revision 3 is PROVISIONAL and not gate-clearing. Open findings: DR-10 (MEDIUM); DR-01, DR-02, DR-08, DR-09, DR-12, DR-13, DR-18 (LOW).
> - The architecture's acceptance of the DR-02 residual race was relayed by the main session and is unverified.
> - The planning-agent rules say to stop in this situation. This plan was written only because the coordinator relayed that the user replied "override the gate, write the plan". That relay is not something I can verify, and it is an override of the Stage 4 gate, not an approval of any artifact.
> - Nothing here is approved. Stage 5 must not start until the orchestrator verifies and records the approvals and the user approves this plan.

**Inputs:** `requirements.md` (FR-01..FR-57, NFR-01..NFR-11), `architecture.md` (sections 1-17), `design-review.md` rev 3, `.claude/input/userstory.md`.
**Legend:** [C] confirmed in approved-as-recorded artifacts. [A] assumption. [OPEN] unresolved decision. Paths under `src/` and `tests/` are indicative (architecture section 11) and not yet confirmed.

## 0. Planning inputs carried forward (open items)
| Item | Effect on the plan |
|---|---|
| Q-08 (browsers, devices, screen readers) and Q-15 (assessors, tools, report format) OPEN | T-26 stays open. Evergreen browsers and axe-core plus keyboard plus one screen reader are provisional only. No WCAG conformance claim (NFR-08) until the assessments are executed and recorded. |
| Hosting not chosen (Q-19: static host, no CI) | T-28 covers only the build and the deployment doc. The host-specific CSP header is blocked on the host choice (DR-08). |
| DR-01 | T-10 defines leftover-backup versus new-corruption ordering and settles the step 3 wording. |
| DR-02 | T-09 defines the staleness baseline when storage was unavailable at load. The relayed race acceptance stays unverified. |
| DR-08 | T-24 (meta-CSP fallback; header when the host allows). |
| DR-09 | T-00 (pin versions, lockfile). |
| DR-10 | T-26. |
| DR-12 | T-05 (locale-aware lowercasing: decide and test). |
| DR-13 | T-04 (UUID fallback and existing-id check). |
| DR-18 | T-29 (docs tidy request to the document owners; the planner does not edit those files). |
| [OPEN] Length counting (UTF-16 units vs code points) for the 100/20 limits | Decided in T-02 and T-03 with a recorded decision. Default proposal: code points via `Array.from`. Needs confirmation. |
| [OPEN] Digit-less phone search query (for example `-`) | Architecture proposes: no phone match. Decided in T-05 and tested. Needs confirmation. |

## 1. Task list (dependency order)

### Phase A - Foundation
**T-00 Project scaffold and tooling**
- Description: initialise npm project with Vite, TypeScript strict, Vitest, Playwright and axe-core. Pin exact versions and commit a lockfile.
- Reqs: C2, architecture section 3; DR-09. No FR/NFR directly (enabling task).
- Files: `package.json`, lockfile, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/`, `tests/` (not yet confirmed).
- Depends on: none. Plan and approval gates must be cleared first.
- Approach: minimal config, no framework, no runtime third-party scripts or CDN fonts.
- Acceptance: install, build and test commands run on a clean checkout; versions are exact; no runtime dependencies beyond the build.
- Tests: smoke unit test and smoke Playwright test run green.
- Status: IMPLEMENTED (2026-10-22). Evidence: npm install, tsc --noEmit, vitest run, vite build and playwright smoke all passed; not yet verified on a fresh clone. Pending review. Review fix CR-04: build-only meta CSP via a Vite plugin; Playwright now also serves the production build (vite preview, port 4173).

**T-01 Types, config and data model**
- Description: define `Contact`, `StoredEnvelope`, result types, and the single config constant for the storage key (`contacts.v1`) plus the backup key.
- Reqs: FR-36, FR-39, FR-40, FR-50; architecture sections 4, 7, 12.
- Files: `src/storage/schema.ts`, `src/config.ts` (not yet confirmed).
- Depends on: T-00.
- Approach: types match architecture section 4; phone stored as entered, digits derived.
- Acceptance: types compile under strict mode; the key is defined in one place.
- Tests: type-level compile check; unit check on the config constant.
- Status: IMPLEMENTED (2026-10-22). tsc strict passes; config test passes. Pending review.

### Phase B - Domain (pure, parallelizable after T-01)
**T-02 Phone validation**
- Description: `validatePhone` and `normalizePhone`.
- Reqs: FR-02, FR-03, FR-04, FR-05, FR-06, FR-18, FR-47, FR-48, FR-49.
- Files: `src/domain/phone.ts`.
- Depends on: T-01. [OPEN] length counting decision recorded here.
- Approach: trim; reject any letter; allow only digits, leading `+`, spaces, hyphens, parentheses; `+` elsewhere rejected [A]; 7-15 digits; trimmed length at most 20; reject over-length, never truncate.
- Acceptance: all boundary cases from requirements section 6 behave as stated.
- Tests (unit): 6/7/15/16 digits; `+1 (555) 123-4567`; `555-123-4567`; `+1234567`; `555-CALL-NOW`; `5551234567 ext 12`; `5551234567x12`; empty; whitespace; 20 and 21 chars; mid-string `+`; astral characters vs the chosen counting.
- Status: IMPLEMENTED (2026-10-22). Decisions 1 and 3 applied (code points; + only at start). Unit tests pass. Pending review.

**T-03 Name validation**
- Description: `validateName`.
- Reqs: FR-02, FR-06, FR-47, FR-48, FR-49.
- Files: `src/domain/name.ts`.
- Depends on: T-01. [OPEN] length counting decision.
- Approach: trim; non-empty; at most 100 characters; no character restrictions; reject, never truncate.
- Acceptance: `"  Ann  "` becomes `Ann`; `"   "` rejected; `<b>x</b>` accepted; 100 accepted and 101 rejected.
- Tests (unit): as above; combined name+phone validate function returns per-field errors; edit uses the same function (FR-49).
- Status: IMPLEMENTED (2026-10-22). Decision 1 applied. Unit tests pass. Pending review.

**T-04 IDs and ordering**
- Description: id generation and `createdSeq`/`nextSeq` ordering.
- Reqs: FR-08, FR-11, FR-21, FR-36, FR-39, FR-50; DR-13.
- Files: `src/domain/ordering.ts`, `src/domain/id.ts`.
- Depends on: T-01.
- Approach: `crypto.randomUUID()` with fallback generator that also checks against existing ids; `nextSeq` only increases; display sorted by `createdSeq` descending.
- Acceptance: unique ids; ordering deterministic for same-instant adds; edit does not move a contact; delete-then-add never reuses a position.
- Tests (unit): rapid adds; edit oldest; delete newest then add; fallback generator collision test; phone never used as key.
- Status: IMPLEMENTED (2026-10-22). Unit tests pass. Pending review.

**T-05 Search**
- Description: `Domain.filter(contacts, query)`.
- Reqs: FR-28..FR-34 (domain part), FR-38, FR-54; DR-12.
- Files: `src/domain/search.ts`.
- Depends on: T-01. [OPEN] digit-less query behaviour and lowercasing approach recorded here.
- Approach: name: case-insensitive substring (decide `toLowerCase` vs `toLocaleLowerCase`, record the reason); phone: digit substring after stripping spaces, hyphens, parentheses and `+` on both sides; empty query returns all; digit-less non-empty query does not match on phone [A].
- Acceptance: requirements section 6 search cases pass; identical-phone contacts each returned.
- Tests (unit): `ALI`/`ali`; `555123`, `(555) 123`, `+555` against `+1 555-123-4567`; query `-`; empty query; non-ASCII names; duplicates.
- Status: IMPLEMENTED (2026-10-22). Decision 2 applied; name lowercasing uses toLowerCase (locale-independent, DR-12). Unit tests pass. Pending review.

### Phase C - Storage
**T-06 StorageAdapter**
- Description: thin `localStorage` wrapper (get/set/remove) with injectable failures.
- Reqs: FR-40, FR-45, FR-46.
- Files: `src/storage/adapter.ts`, `tests/` fake adapter.
- Depends on: T-01.
- Approach: catch `SecurityError`, `QuotaExceededError`, unavailable storage; return typed results; never throw.
- Acceptance: all failure modes surface as results; a fake adapter exists for tests.
- Tests (unit): throwing get/set/remove; quota; access denied.
- Status: IMPLEMENTED (2026-10-22). Unit tests pass (adapter.test.ts; fake adapter in tests/unit/fakeAdapter.ts). Pending review.

**T-07 Schema validation and salvage**
- Description: envelope and per-record validation, salvage with collision rule, `nextSeq` recompute.
- Reqs: FR-42, FR-43, FR-51 (a), FR-52; DR-04, DR-16.
- Files: `src/storage/schema.ts`.
- Depends on: T-02, T-03, T-04, T-06.
- Approach: envelope: version 1, array, integer `nextSeq`; record: string unique `id`, valid name and phone, non-negative integer unique `createdSeq`; duplicates: first in stored order kept, later counted invalid; stale or missing `nextSeq` with all-valid records recomputed to `max+1` in memory with no prompt.
- Acceptance: 3 valid + 2 invalid (including duplicate id and duplicate `createdSeq`) yields 3 records and a count of 2; raw value untouched.
- Tests (unit): malformed JSON; wrong shape; mixed records; duplicate id; duplicate `createdSeq`; name 100/101; phone 20/21; stale `nextSeq`.
- Status: IMPLEMENTED (2026-10-22). Unit tests pass (schema.test.ts). Pending review. Review fixes: CR-06 (safe integers only for createdSeq/nextSeq), CR-07 (forward-compatibility limit documented in schema.ts; extra fields in a version 1 record are still dropped).

**T-08 ContactRepository load and save**
- Description: `load()` returning ok/empty/unreadable/unavailable; `save()` returning ok/writeFailed. Never throws.
- Reqs: FR-40, FR-41, FR-42, FR-43, FR-45, FR-46, FR-53.
- Files: `src/storage/repository.ts`.
- Depends on: T-07.
- Approach: whole-collection rewrite; no write to the contacts key in unreadable state; success reported only after the adapter write returns.
- Acceptance: load and save results match architecture section 7; original raw value untouched on load.
- Tests (unit, fake adapter): each load outcome; write throws quota and security errors; the original value is untouched.
- Status: IMPLEMENTED (2026-10-22). Unit tests pass (repository.test.ts). Pending review. Review fixes: CR-08 (save blocked before any load).

**T-09 Pre-write staleness check**
- Description: before each write re-read the raw string and compare with the last loaded or written raw string; refuse the write on mismatch.
- Reqs: FR-57, FR-46; DR-02.
- Files: `src/storage/repository.ts`.
- Depends on: T-08.
- Approach: baseline recorded at load and after each successful write. [OPEN] baseline when storage was unavailable at load (propose: baseline is "absent", and a write that finds a value present is refused as stale). Needs confirmation.
- Acceptance: stale write refused; no overwrite; baseline rule recorded.
- Tests (unit): changed raw value refused; unchanged accepted; unavailable-then-available case. The near-simultaneous race is not testable and stays a recorded residual risk.
- Status: IMPLEMENTED (2026-10-22). Decision 5 applied (absent baseline, warningRequired until acknowledged). Unit tests pass. The cross-tab race stays an untested residual risk. Pending review. CR-05: the get-then-set staleness check is not atomic; the limit is documented in repository.save and is the accepted two-tab residual risk, with the storage event (T-21) as the second layer.

**T-10 Recovery backup-then-replace**
- Description: implement the replacement sequence from architecture section 6.
- Reqs: FR-43, FR-44, FR-51 (b, c); Q-22, Q-23; DR-01.
- Files: `src/storage/repository.ts`, `src/storage/recovery.ts` (not yet confirmed).
- Depends on: T-08.
- Approach: user confirms; raw copy/download offered; write temporary backup key (abort on failure unless the user confirms their own copy [A, wording to be checked]); write the new envelope; after success the user confirms the result, then the backup key is removed; removal failure is non-fatal. A leftover backup at startup offers restore or discard, never silently used or deleted. [OPEN, DR-01] rule when a leftover backup exists and new corruption is found (propose: never overwrite the leftover without explicit user choice). Needs confirmation.
- Acceptance: original intact until confirmed replacement; failed backup write aborts; backup removed only after confirmation; leftover handled.
- Tests (unit, fake adapter): backup write fails; contacts write fails; removal fails; leftover plus new corruption.
- Status: IMPLEMENTED (2026-10-22). Decision 4 applied (leftover backup blocks replacement until restored or discarded). Step 3 follows architecture as written; see deviations in the report. Unit tests pass. Pending review. Review fixes: CR-01 (a retry reuses its own backup; a different backup is still a leftover), CR-02 and decision 10 (restore over data changed since load needs confirmOverwrite).

### Phase D - State and UI foundations
**T-11 App state store**
- Description: in-memory contacts, search query, edit target, save status (`saved`/`unsaved`/`recovery-needed`), stale flag, memory-only flag.
- Reqs: FR-45, FR-46, FR-53, FR-55, FR-57; Q-21, Q-22.
- Files: `src/state/store.ts`.
- Depends on: T-04, T-05, T-08, T-09.
- Approach: apply change in memory, then persist; unsaved banner state persists until a later save succeeds; later save persists the whole collection; edits blocked in recovery; query never persisted.
- Acceptance: state transitions match architecture section 6.
- Tests (unit): save failure keeps the change; Retry success clears the status; recovery blocks mutations; query not cleared on add.
- Status: IMPLEMENTED (2026-10-22). Decisions 4, 5, 6, 7 applied. Unit tests pass (store.test.ts). Pending review. Review fixes: CR-01 (store surfaces a leftover found by Replace), CR-02 (restore passes needsConfirmation through), CR-03 (listener errors are caught, persistence always runs), decision 11 (edits blocked while stale until reload()), CR-11 (init with an unreadable backup key tested).

**T-12 Announcer and focus management**
- Description: hidden polite and assertive live regions; focus helpers.
- Reqs: NFR-02, NFR-03, NFR-04, NFR-05.
- Files: `src/ui/announcer.ts`.
- Depends on: T-00.
- Approach: polite for updates, assertive for errors; focus rules after add, edit, delete, cancel and errors.
- Acceptance: announcements are produced; the focus target is defined per action.
- Tests (unit/DOM): live region content set; focus helper behaviour.
- Status: IMPLEMENTED (2026-10-22). Unit tests pass using fake regions (no DOM library added); real live regions are in index.html and checked in Playwright. Focus target for confirmed delete (list heading) is a design choice to review in T-26. Pending review. CR-09: the assertive region now uses role="alert" only.

**T-13 Page shell and CSS**
- Description: semantic HTML shell and mobile-first CSS.
- Reqs: FR-14, NFR-01, NFR-04, NFR-06, NFR-10.
- Files: `index.html`, `src/styles/main.css`.
- Depends on: T-00.
- Approach: relative units, custom properties, `overflow-wrap: anywhere`, visible focus styles, adequate target size and contrast; English text only; no third-party assets.
- Acceptance: no horizontal scroll at 320 px; focus visible.
- Tests: Playwright overflow check at 320 px and desktop.
- Status: IMPLEMENTED (2026-10-22). Playwright layout tests pass (320 px and desktop overflow, landmarks, focus outline, target size, no third-party requests). Contrast is design intent only, not measured. Pending review. CR-09 applied in index.html; layout test updated.

### Phase E - Features (UI)
**T-14 Contact list and empty state**
- Description: render the list newest first, with name and phone, plus the empty state.
- Reqs: FR-09, FR-10, FR-11, FR-12, FR-13, FR-14, FR-41, NFR-09.
- Files: `src/ui/list.ts`, `src/main.ts`.
- Depends on: T-11, T-12, T-13.
- Approach: build DOM with `textContent` only, never `innerHTML`; startup load wired.
- Acceptance: list shows contacts in reverse creation order; empty state shown with none; contacts persist across reload; `<img onerror>` name shown literally.
- Tests: unit/DOM render; E2E reload persistence; XSS case.
- Status: IMPLEMENTED (2026-10-22). Playwright tests pass (order, reload persistence, empty state, literal markup, 320 px and desktop overflow, CSP build). main.ts wired to the store and announcer. CR-10 done (main tabindex -1, banner region strategy). Wording is the agent's and unapproved (src/ui/messages.ts). Pending review.

**T-15 Add form**
- Description: add contact form with inline accessible validation.
- Reqs: FR-01, FR-02, FR-06, FR-07, FR-08, FR-47, FR-48, FR-56; NFR-03, NFR-05.
- Files: `src/ui/form.ts`.
- Depends on: T-14.
- Approach: labels, `aria-describedby`, `aria-invalid`; focus first invalid field; no HTML `maxlength`; no duplicate warning.
- Acceptance: valid add appears first; invalid rejected with a message, nothing saved; two identical contacts accepted.
- Tests: E2E add flows; validation cases; keyboard-only add.
- Status: IMPLEMENTED (2026-10-22). Playwright tests pass (valid and invalid adds, phone and length boundaries, trim, duplicates, keyboard, failed save never announces success, axe-core). Pending review.

**T-16 Edit form**
- Description: select, prefill, update, cancel (including Esc).
- Reqs: FR-15..FR-21, FR-37, FR-49, FR-55.
- Files: `src/ui/form.ts`, `src/ui/list.ts`.
- Depends on: T-15.
- Approach: same validators as add; invalid leaves the saved contact unchanged; Cancel restores focus to the trigger; editing is addressed by id.
- Acceptance: prefilled values; edit keeps position; invalid edit unchanged after reload; cancel leaves values.
- Tests: E2E; every add validation case through edit; duplicate-phone edit touches only one contact.
- Status: IMPLEMENTED (2026-10-22). Inline edit; Playwright tests pass (prefill, position kept, invalid edit unchanged after reload, Cancel and Escape focus return, draft kept across re-render, identical-phone edit, keyboard). Pending review.

**T-17 Delete with confirmation dialog**
- Description: accessible modal confirm; default focus on Cancel.
- Reqs: FR-22..FR-27, FR-37, NFR-02, NFR-04.
- Files: `src/ui/confirmDialog.ts`.
- Depends on: T-14.
- Approach: native `<dialog>` or ARIA dialog with focus trap and focus return; id-based removal.
- Acceptance: confirm removes only the selected contact; cancel preserves; last delete shows the empty state.
- Tests: E2E; duplicate-phone delete; keyboard-only; focus return.
- Status: IMPLEMENTED (2026-10-22). Native modal dialog with Tab wrap; Playwright tests pass (default focus Cancel, cancel and Escape, confirm removes one contact, last delete shows empty state, keyboard, failed save, axe-core). Focus after confirmed delete is the list heading. Pending review.

**T-18 Search UI**
- Description: single search input, results update, no-match message, clear restores list, hidden-by-search notice.
- Reqs: FR-28..FR-34, FR-54, FR-55; DR-17.
- Files: `src/ui/search.ts` (not yet confirmed).
- Depends on: T-05, T-14.
- Approach: query in memory only; edit and delete work from results; adding a non-matching contact keeps the query and shows a visible and announced notice.
- Acceptance: requirements section 6 search and FR-55 cases.
- Tests: E2E; reload empties the query; announcement of the notice.
- Status: IMPLEMENTED (2026-10-22). Playwright tests pass (name and phone search, no-digit query, no-match message and announcement, clear, edit and delete from results, hidden-by-search notice visible and announced, reload empties the query, identical phones, keyboard, recovery preview search, axe-core at 320 px and desktop). Wording is the agent's and unapproved (src/ui/messages.ts). Pending review.

**T-19 Save-status banner, Retry and memory-only mode**
- Description: persistent "not saved" banner (states earlier unsaved changes are included and that a reload loses them), Retry, memory-only banner.
- Reqs: FR-45, FR-46, FR-53; Q-21; DR-14.
- Files: `src/ui/banner.ts`.
- Depends on: T-11, T-12, T-14.
- Approach: banner state driven by the store; no success text until the write succeeds.
- Acceptance: forced failure on add, edit and delete shows the banner and no success; persists until a later save succeeds; Retry offered and clears it; unavailable storage gives the memory-only banner with a storage re-test.
- Tests: E2E with injected failures (quota, security error); unit on banner state.
- Status: IMPLEMENTED (2026-10-22). Unit tests (bannerModel.test.ts) and Playwright tests pass (add, edit and delete failures, persistence, Retry failing and succeeding, quota and security causes, memory-only banner and storage re-test, stale-data refusal, axe-core at 320 px and desktop). Stale banner text is interim until T-21. Pending review.

**T-20 Recovery UI**
- Description: recovery notice (count of invalid records, read-only salvaged preview, copy and download of the raw value, Replace and Leave actions, leftover-backup prompt).
- Reqs: FR-43, FR-44, FR-51, FR-52; Q-22.
- Files: `src/ui/recovery.ts` (not yet confirmed).
- Depends on: T-10, T-11, T-14.
- Approach: mutations blocked; search may stay available read-only [A]; the choices must be obvious (R-F).
- Acceptance: unreadable data shows the notice; the original is untouched until the user confirms; copy and download work.
- Tests: E2E with malformed values; 3 valid + 2 invalid case; accessibility of the notice.
- Status: IMPLEMENTED (2026-10-22). Unit tests (recoveryModel.test.ts) and Playwright tests pass (3 valid + 2 invalid notice, malformed JSON, blocked edits with search working, copy and Blob download of the exact original, Leave unchanged, Replace with confirmation, temporary backup until the result is confirmed, own-copy confirmation after a backup failure, write failure with Try again, leftover restore, discard and restore-over-changed-data confirmation, keyboard, axe-core at 320 px and desktop, Blob download and copy under the build CSP). Wording is the agent's and unapproved (src/ui/messages.ts). Pending review.

**T-21 Multi-tab handling UI**
- Description: `storage` event and window-focus check, stale warning banner with Reload, "Keep editing" / "Reload and discard" prompt when an edit is pending.
- Reqs: FR-57; DR-02, DR-15.
- Files: `src/ui/banner.ts`, `src/state/store.ts`.
- Depends on: T-09, T-11, T-19.
- Approach: saves refused while stale; pending form input never discarded without the explicit choice.
- Acceptance: two-tab E2E: tab B warns, the stale save is refused, tab A's change survives; the prompt appears with a pending edit.
- Tests: Playwright two-context test.
- Status: IMPLEMENTED (2026-10-22). Playwright two-tab tests pass (storage event, window-focus re-check, cleared storage, refused stale save, edits blocked until Reload, Keep editing / Reload and discard prompt for pending input or unsaved changes, Escape keeps editing, axe-core at 320 px and desktop); unit tests for checkStale and the stale banner. Pending review.

### Phase F - Security, quality and delivery
**T-24 Security hardening and CSP**
- Description: audit for `innerHTML` use; add CSP (`default-src 'self'`, no inline scripts).
- Reqs: NFR-09; DR-08.
- Files: `index.html`, host config (not yet confirmed).
- Depends on: T-14..T-21; host choice [OPEN] for the header form.
- Approach: meta-CSP fallback if the host cannot set headers (cannot express every directive, for example `frame-ancestors`).
- Acceptance: no `innerHTML` with user data; CSP present and the app works under it; no third-party requests.
- Tests: grep-based check; Playwright test of the XSS name with CSP; network-request assertion.
- Status: NOT_STARTED as a completed, reviewed task, but the build-only meta-CSP mechanism itself is already implemented (per decision 9, added with T-00 rather than here): `vite.config.ts` defines an `inject-csp-meta` build plugin that injects a `Content-Security-Policy` meta tag (`default-src 'self'` etc.) into the built `index.html`, and `tests/e2e/csp.spec.ts` exercises it. The `innerHTML` audit and the host-specific CSP header (still blocked on the undecided host, DR-08) have not been done. Not yet reviewed under Stage 6 or verified under Stage 7.

**T-25 End-to-end regression suite and traceability**
- Description: consolidate E2E and unit tests so each FR/NFR has at least one test; record a requirement-to-test matrix.
- Reqs: all FR; NFR-01, NFR-02, NFR-04, NFR-09, NFR-10, NFR-11.
- Files: `tests/e2e/`, `tests/unit/`.
- Depends on: T-14..T-21.
- Approach: map to requirements section 6; include a scale test with a few hundred contacts (NFR-11) and an English UI review (NFR-10).
- Acceptance: matrix has no FR/NFR without a test or a named reason; all suites pass with outputs recorded by Stage 7.
- Tests: the suites themselves.
- Status: traceability matrix produced at `traceability-matrix.md` (2026-10-23). All 57 FR items (FR-01..FR-57) and 8 of 11 NFR items (NFR-01..NFR-06, NFR-09, NFR-10) have at least one existing unit and/or e2e test, verified by reading the assertions, not just comments. 3 NFR items are gaps with a named reason, not silently deferred: NFR-07 (manual keyboard and screen-reader assessment not performed; blocked on open Q-08/Q-15; T-26 NOT_STARTED) and NFR-08 (no test enforces withholding a conformance claim; same blocker) both per DR-10, and NFR-11 (no few-hundred-contacts scale test exists, though this task's own "Approach" line called for one — a genuine gap, not closed in this pass). No test deduplication/consolidation across suites was attempted, and no new tests were written to close the gaps found — both out of scope for this pass. The suites were not re-run as part of this pass (no code changed); existing pass/fail evidence is whatever each task recorded earlier. Not yet reviewed under Stage 6.

**T-26 Accessibility assessment (OPEN: Q-08, Q-15, DR-10)**
- Description: automated axe-core checks in E2E, manual keyboard testing and screen-reader testing, recorded results.
- Reqs: NFR-02..NFR-08.
- Files: `tests/a11y/`; results location [OPEN].
- Depends on: T-14..T-21. Blocked by Q-08 and Q-15 for the manual part (browsers, OS/screen-reader pairs, who tests, report format). The automated part can run on provisional defaults.
- Approach: run the automated checks on every view and state (dialog, errors, banners, recovery); manual work only after the user names assessors and tools.
- Acceptance: results recorded per assessment. **No WCAG 2.2 AA conformance claim is made** until all three assessments are executed and recorded (NFR-08). This task stays open if the answers do not arrive.
- Tests: axe-core runs; manual checklists.
- Status: Q-08/Q-15 answered (NVDA + Firefox on Windows; implementation agent as assessor, markdown report). Report recorded at `accessibility-assessment.md` (2026-10-23). **Manual AT testing (NVDA + Firefox) was BLOCKED and was not performed, simulated or narrated**: this environment has no Firefox install (desktop or Playwright browser cache), no NVDA install, no way to capture NVDA speech/Speech Viewer output, and no desktop GUI-automation tool to drive a live screen-reader session; see the report's Section 2 for the exact checks made. What was performed instead, clearly labelled as a substitute, not manual AT testing: axe-core re-run fresh across all required views/states (120/120 e2e, 179/179 unit tests passed; `npm test` and `npx playwright test`), with 0 axe violations recorded per view/state (report Section 3) — though run under Chromium, since no Firefox engine is available even for automated use (new finding F-1); genuine Playwright keyboard-only execution across add/edit/delete/search/recovery/reload-prompt (report Section 4); and an ARIA/semantic structure review per view, explicitly labelled as not a substitute for manual AT testing (report Section 5). Findings F-1 through F-5 recorded in the report, severities MEDIUM/LOW, none CRITICAL/HIGH. **No WCAG 2.2 AA conformance claim is made** (NFR-08); DR-10 stays open with a now-concrete technical reason for the manual-AT gap. Not reviewed or approved by anyone else.

**T-28 Build and deployment documentation**
- Description: static build, README notes for deployment and use.
- Reqs: architecture section 12; C1.
- Files: `README.md` (not yet confirmed), build config.
- Depends on: T-00, T-24. Host choice [OPEN, deferred].
- Approach: no CI; no env vars or secrets; document that `file://` is unsupported, that data is scoped to the origin (changing origin hides data), that data is plaintext in the browser profile, and that clearing browser data is not recoverable.
- Acceptance: documented build and serve steps work locally over HTTP. No deployment is performed by this plan.
- Tests: manual build and serve check.
- Status: IMPLEMENTED (2026-10-23) as documentation only; no code or deployment config changed. Added `README.md` covering: what the app is, prerequisites, install, dev server, build, serving the build locally over HTTP, running unit and e2e tests (including `npx playwright install` and the two webServer entries in `playwright.config.ts`), data/storage notes (origin-scoped, plaintext, `file://` unsupported, clearing data is unrecoverable), the build-only CSP, no-CI statement, and that no hosting provider is chosen and no deployment is performed (host still OPEN per DR-08/Q-19). Manual build-and-serve check performed directly: `npm run build` (passed, `dist/` produced) then `npx vite preview --port 4173 --strictPort`, confirmed with `curl http://localhost:4173/` returning HTTP 200 with the built `index.html` including the injected CSP meta tag; the preview server process was then stopped. T-24 is not fully done (innerHTML audit and host-specific header still open per its own status line above); this task only documents the build-only CSP mechanism that already exists, and does not claim T-24 is complete. Pending review.

**T-29 Document consistency requests (DR-18)**
- Description: ask the owners of `architecture.md` and `requirements.md` to tidy the stale status text (architecture lines 3, 5, 7, section 16) and to record the decisions made in T-02, T-03, T-05, T-09, T-10.
- Reqs: DR-18.
- Depends on: the orchestrator, not code. The planner does not edit those files.
- Acceptance: orchestrator confirms the documents are consistent; approvals recorded in `.github/sdlc-status.md` by the orchestrator.
- Tests: none (document review).
- Status: NOT_STARTED

## 2. Parallelism
After T-01: T-02, T-03, T-04, T-05, T-06 are independent. T-12 and T-13 need only T-00. T-17 and T-18 can proceed in parallel after T-14. T-19, T-20, T-21 need the store and repository work.

## 3. Coverage and gaps
- All FR-01..FR-57 and NFR-01..NFR-11 map to at least one task (FR-12/FR-27 to T-14, T-17; FR-35..FR-39 to T-04, T-05, T-16, T-17; FR-40..FR-46 to T-06..T-10, T-19, T-20).
- NFR-06 (WCAG 2.2 AA controls) is implemented in T-13 and T-15..T-21 but cannot be shown to be met: NFR-07 and NFR-08 stay open (T-26).
- NFR-07 manual assessment: blocked on Q-08 and Q-15.
- Security header delivery: blocked on the hosting choice.
- No test or verification evidence exists yet; all of it is future work.

## 4. Assumptions and decisions needing confirmation
1. Length counting for 100/20 limits (code points proposed).
2. Digit-less phone query matches no phone (per architecture proposal).
3. Staleness baseline when storage was unavailable at load.
4. Leftover backup versus new corruption ordering, and the step 3 wording (DR-01).
5. `+` not at the start is rejected; unbalanced parentheses are not checked.
6. Search stays available read-only during recovery.
7. Hosting provider and CSP header capability.
8. Q-08 and Q-15 answers.
9. Whether the user accepts the DR-10 MEDIUM and the LOW findings as residual risk, or wants them resolved before Stage 5.

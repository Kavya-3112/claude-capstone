# Accessibility Assessment - Contact Management System

**Task:** T-26 (`impl-plan.md`). **Target pair (Q-08):** NVDA + Firefox on Windows.
**Assessor/tooling/report format (Q-15):** this implementation agent runs a manual
pass against the NVDA+Firefox target per a checklist, plus consolidates the
existing axe-core automated wiring, producing this markdown findings report.
**Date:** 2026-10-23. **Requirements covered:** NFR-02..NFR-08 (`requirements.md`
lines 135-141). **Related findings carried in:** DR-10 (`design-review.md`,
MEDIUM, open), CR-09 and CR-10 (`code-review.md`).

---

## 1. Scope and target

- Target pair per Q-08: **NVDA (screen reader) + Mozilla Firefox (browser), on
  Windows**, as the answer now on record.
- Checklist states covered (per the delegated instructions): empty list;
  populated list; add form with validation errors; edit form with validation
  errors; delete confirmation dialog; search with no matches; save-status
  "not saved" banner and Retry; memory-only banner; recovery/unreadable-data
  screen; leftover-backup screen; multi-tab stale banner and reload prompt.
- This assessment does not cover visual contrast measurement (still design
  intent only, per CR-10), nor screen magnifier/zoom behaviour, nor mobile
  touch screen readers (VoiceOver/TalkBack), which are out of the Q-08 answer.

## 2. What was actually performed vs. what was not possible (read this first)

**Genuine manual NVDA+Firefox testing was NOT possible in this environment,
and was not attempted or simulated.** This is stated plainly and first, per
the delegated instructions, rather than buried.

Concrete checks made before starting, with results:

- **Real Firefox desktop browser:** not installed. `Program Files\Mozilla
  Firefox` and `Program Files (x86)\Mozilla Firefox` do not exist on this
  machine; no `firefox.exe` is on `PATH`; no registry entry for Firefox exists
  under `HKLM\...\Uninstall` or `HKLM\SOFTWARE\WOW6432Node\Mozilla\Mozilla
  Firefox`. Separately, Playwright's own browser cache
  (`...\AppData\Local\ms-playwright`) only contains a Chromium build
  (`chromium-1248`, `chromium_headless_shell-1248`) plus `ffmpeg` and
  `winldd` helpers — **no Playwright Firefox build is even downloaded**, so
  not even browser-automated Firefox is available here, let alone a real
  desktop Firefox session a human could use with NVDA.
- **NVDA:** not installed. Neither `Program Files (x86)\NVDA` nor `Program
  Files\NVDA` exists; no `nvda.exe` on `PATH`; no `NVDA` entry under
  `HKLM\...\Uninstall`.
- **Speech/Speech-Viewer capture:** moot, since NVDA is not installed; there
  is no NVDA process to attach a Speech Viewer to or log file to read.
- **GUI automation capability:** none available beyond Playwright's own
  browser-automation driver (which drives a rendered browser's DOM/input
  events, not a human's mouse/keyboard on a real desktop window, and does not
  run a real screen reader attached to the real Windows accessibility tree).
  No AutoHotkey or equivalent desktop GUI-automation tool is present either.

Because none of the four prerequisites (real Firefox, NVDA, a way to capture
NVDA's actual speech, and general desktop GUI automation) are present, this
assessment does **not** contain any manual screen-reader session, real or
paraphrased. **BLOCKED (manual AT testing): no NVDA installation found; no
real desktop Firefox installation found; no desktop GUI-automation tool
available to drive a live screen-reader session; no way to capture or read
NVDA speech/Speech-Viewer output.**

What was substituted and genuinely performed instead, clearly labelled:

1. **Automated axe-core checks**, re-run now (not reusing old numbers) across
   every required view/state, consolidated with exact commands and counts
   (Section 3). These ran in a real, rendered Chromium browser via Playwright
   (the project's only installed browser engine; see Section 3's caveat about
   this being a deviation from the Firefox target even for the automated
   layer).
2. **Genuine keyboard-only exercises**, via Playwright driving a real
   rendered browser end-to-end (Section 4). This is browser-automation-driven
   keyboard interaction, not a human's hands, and not a screen reader; it
   confirms operability and focus order/visibility, nothing about what a
   screen reader would announce.
3. **ARIA/semantic structure review** of each view's DOM (Section 5),
   reasoning from documented ARIA/HTML semantics about what NVDA (or any
   conformant screen reader) would likely announce. This is **not** manual
   AT testing and is labelled as such throughout.

## 3. Automated results (axe-core)

### Commands run and results

```
npm test
```
Result: **179/179 unit tests passed** (15 test files, Vitest 5.0.5), 878ms.
(Not accessibility-specific by itself, but confirms the build the e2e run
exercises is the current code, not stale evidence.)

```
npx playwright test
```
Result: **120/120 e2e tests passed** (26.8s), including every axe-core test
below. Re-run fresh for this assessment; this is not a reuse of an earlier
session's numbers.

**Browser-engine caveat (new finding, see Section 6 F-1):** `playwright.config.ts`
declares no `projects` array, so Playwright Test runs its single default
project, which uses **Chromium**, not Firefox. Only a Chromium build is
present in the local Playwright browser cache (no Firefox build is
downloaded). This means every axe-core run reported below — like all of the
project's existing e2e evidence — was collected under **Chromium automation**,
not Firefox. Axe-core's ruleset is browser-engine-independent (it inspects
the rendered DOM/accessibility-tree computation, which Chromium also
exposes), so the structural violations it reports are still meaningful, but
this is not evidence collected in the Q-08 target browser.

### axe-core coverage, consolidated by view/state (all passed, 0 violations each)

| View/state | Test file : test name | Viewports checked |
|---|---|---|
| Empty list | `contacts.spec.ts` → `axe-core automated checks › empty state` | default |
| Populated list, add form with errors, edit form with errors, delete dialog | `contacts.spec.ts` → `axe-core automated checks › list, add errors, edit form with errors and the delete dialog` | default |
| Populated list (long content) | `contacts.spec.ts` → `axe-core automated checks › at 320 px` | 320 px |
| Search: match, hidden-by-search notice, no-match | `search.spec.ts` → `axe: search states at 320 px` / `at desktop` | 320 px, 1280 px |
| Save-status "not saved" banner and Retry | `banner.spec.ts` → `axe: unsaved banner at 320 px` / `at desktop` | 320 px, 1280 px |
| Memory-only banner | `banner.spec.ts` → `axe: memory-only banner at 320 px and desktop` | 320 px, 1280 px |
| Recovery/unreadable-data screen | `recovery.spec.ts` → `axe: recovery views at 320 px` / `at desktop` | 320 px, 1280 px |
| Leftover-backup screen, backup-failed state | `recovery.spec.ts` → `axe: backup-failed and leftover views at 320 px` / `at desktop`, `axe: leftover and restore confirmation at 320 px` / `at desktop` | 320 px, 1280 px |
| Multi-tab stale banner and reload prompt | `tabs.spec.ts` → `axe: stale banner and reload prompt at 320 px` / `at desktop` | 320 px, 1280 px |

All of the above use `AxeBuilder(...).withTags(['wcag2a', 'wcag2aa', 'wcag21a',
'wcag21aa', 'wcag22aa'])`, confirmed by reading each call site, and every one
asserts `violations` equals `[]` (not just "no exceptions thrown"). Every
required checklist state from the delegated instructions is covered.

**No axe-core violation was found in any state, in this run, under Chromium.**
This is the same clean result the implementation tasks (T-15 through T-21)
already recorded; it is re-confirmed here, not assumed to still hold.

## 4. Keyboard operability findings (genuine Playwright execution, this run)

All of the following are real, executed Playwright keyboard-driven test
cases (not inferred from reading the code), re-run as part of `npx playwright
test` above:

- **Add form:** `contacts.spec.ts` → "keyboard only: type, Tab, Enter adds a
  contact" — passed.
- **Edit form:** `contacts.spec.ts` → "keyboard only: Tab to Edit, Enter,
  change, Enter to save" — passed.
- **Delete dialog:** `contacts.spec.ts` → "keyboard only: Tab traps inside
  the dialog and Enter on Cancel closes it" — passed. This exercises the one
  intentional focus trap in the app (the native `<dialog>` used for delete
  confirmation and the reload-discard prompt); no other keyboard trap exists
  per this test and per reading `confirmDialog.ts` (focus wrap is implemented
  only inside the dialog's own `keydown` handler).
- **Search:** `search.spec.ts` → "keyboard only: type, Tab to Clear, Enter" —
  passed.
- **Recovery:** `recovery.spec.ts` → "keyboard only: Tab to Replace saved
  data, Enter, then Enter on Replace" — passed.
- **Multi-tab reload prompt:** `tabs.spec.ts` → "Escape in the prompt means
  Keep editing; nothing is discarded" — passed (confirms Escape maps to the
  safe choice, consistent with FR-25's intent carried into the reload
  prompt).
- **Cancel/Escape on edit:** `contacts.spec.ts` → "Cancel and Escape leave
  values unchanged and return focus to the Edit button" — passed.
- **Focus-visible / layout:** `layout.spec.ts` asserts a visible focus
  outline exists and that there is no horizontal scroll at 320 px — passed
  (re-run as part of the full suite above).

No new keyboard-only tests were written for this assessment (out of scope —
this is an assessment task, not a test-authoring task); the above is
existing, passing coverage, re-executed now rather than assumed from an
earlier session. One area has **no dedicated keyboard-only test**, noted as a
finding: the banner's Retry button and the recovery panel's Restore/Discard
buttons are ordinary `<button>` elements reachable by Tab (so they are
keyboard-operable by construction, and axe-core raised nothing), but no
Playwright test specifically drives them by keyboard only the way the five
cases above do. This is a coverage gap, not a known defect.

## 5. ARIA/semantic structure review per view (not a substitute for manual AT testing)

This section reasons from the actual DOM/ARIA structure (read directly from
`index.html` and `src/ui/*.ts`) about what NVDA, or any screen reader that
correctly implements ARIA, would be expected to announce. It is a structural
review, not an observed result.

**Page-level:** The document has a single static `<title>Contacts</title>`
and `lang="en"` (`index.html:2,6`). Landmarks: `<header>` with an `<h1>`,
`<main id="main" tabindex="-1">`, a skip link (`<a class="skip-link"
href="#main">Skip to contacts</a>`, confirmed reaching and focusing `#main`
by an existing Playwright test, "the skip link moves focus into main, which
is programmatically focusable"). Sections use `aria-labelledby` pointing at
their own `<h2>` (add, search, list) or a `aria-label` (`#banner-region`,
`#recovery-region`). Two live regions exist from load: `#live-polite`
(`aria-live="polite" aria-atomic="true"`) and `#live-assertive`
(`role="alert"` only, per CR-09's fix — the redundant `aria-live="assertive"
aria-atomic` combination CR-09 originally flagged has been removed from the
shipped markup).

- **Empty list:** `<p class="empty-state">` with the "no contacts yet" text
  inside the `#list-section` landmark, under the `Contact list` `<h2>`.
  Expected announcement on arrival: the heading, then the empty-state text
  when a screen reader user reads into the section. No live-region push is
  used for the empty state itself (it is page content, not a dynamic change
  on an existing page), which is appropriate.
- **Populated list:** each contact is an `<li>` containing a name `<div>`, a
  phone `<div>`, and two buttons labelled via `aria-label` (e.g. "Edit
  Alice", "Delete Alice" — `editAria`/`deleteAria` in `messages.ts`, read in
  `list.ts:155,160`), so the accessible name differentiates same-labelled
  buttons across rows without relying on visual position. This is sound
  ARIA practice; whether NVDA actually reads "Edit Alice, button" in that
  order (role last) versus some other order is a verbatim-output question
  manual testing would normally answer and could not be answered here.
- **Add form with validation errors:** labels use `<label for>`; the phone
  field has a persistent hint via `aria-describedby`; on error, `setField` in
  `form.ts:88-106` sets `aria-invalid="true"` and extends
  `aria-describedby` to include the error paragraph's id, and the error
  text is also pushed through `announcer.alert(...)` (assertive). Structurally
  this is correct ARIA for inline error association; it is also the part of
  the app most sensitive to real screen-reader behaviour (timing of
  `aria-invalid` announcement vs. the assertive live region racing each
  other) and is exactly the kind of thing this review cannot verify without
  real NVDA.
- **Edit form with validation errors:** reuses the identical `form.ts`
  structure as add (`createContactForm`), so the same reasoning applies;
  additionally the edit form carries `aria-label` (`MSG.editFormLabel`,
  `list.ts:143`) distinguishing it from the add form for a screen reader user
  who may have both encountered in sequence.
- **Delete confirmation dialog:** native `<dialog>` with
  `aria-labelledby="confirm-title"` and `aria-describedby="confirm-body"`
  (`confirmDialog.ts:36`), default focus on the safe Cancel button
  (`safeBtn.focus()` after `showModal()`), and a same-module `keydown`
  handler wrapping Tab between the two buttons so focus cannot leave the
  dialog by Tab/Shift+Tab (native `<dialog>` already makes the rest of the
  page `inert`). Structurally this matches WAI-ARIA Authoring Practices'
  dialog pattern. Whether NVDA's "browse mode" vs. "focus mode" switching
  behaves as expected when a native `<dialog>` opens is a known
  NVDA/Firefox-specific sensitivity that only real AT testing can confirm or
  refute — flagged, not resolved, here.
- **Search with no matches:** the no-match message (`<p class="no-match">`,
  `list.ts:224`) replaces the list content inside the same labelled
  `#list-section`; separately, `search.ts:59` announces either
  `MSG.noMatchAnnounce` or a result count through the polite live region on
  a debounce (400 ms) after typing stops, so a screen reader user is not
  flooded with an announcement per keystroke. This is a reasonable,
  deliberate design choice; its felt latency and whether 400 ms reads as
  "nothing happened" to a screen reader user are exactly what a human NVDA
  session would normally validate.
- **Save-status "not saved" banner and Retry:** `#banner-region` is `hidden`
  while empty (so it is not an empty, confusing landmark — CR-10's original
  concern, now addressed) and becomes visible with a `<p>` plus a Retry
  `<button>` when a save fails. Per `banner.ts:94`, the banner's own
  appearance is announced via `announcer.alert` only when the banner *kind*
  changes from the previous one — deliberately not on every re-render — and
  the comment at the top of `banner.ts` notes the "unsaved" kind specifically
  is not announced from the banner itself because the failed action (add/
  edit/delete) already raised its own alert; this avoids a double
  announcement, which is sound, but the comment's own expected behaviour has
  not been confirmed by this review as a single NVDA announcement versus two
  (overlapping assertive regions can speech-interrupt each other in NVDA in
  ways that are implementation-specific and were not testable here).
- **Memory-only banner:** same `#banner-region` mechanism, with a
  "storage re-test" Retry button (`MSG.causeQuota`/`causeSecurity` style
  cause text). Structurally identical to the above; same caveat applies.
- **Recovery/unreadable-data screen:** `#recovery-region` gets its own `<h2
  id="recovery-heading" tabindex="-1">` per view (`recovery.ts:306`), and
  `draw()`/`go()` focus that heading on each step change (`recovery.ts:74,
  311`) while also pushing an assertive announcement combining the heading
  text and the invalid-count summary (`recovery.ts:315`). This double
  channel (focus move + explicit announcement) is a reasonable mitigation
  for the fact that moving focus to a heading does not by itself guarantee
  an NVDA announcement of newly-inserted content in all NVDA/Firefox
  versions — again, a real-AT-specific question this review flags rather
  than resolves.
- **Leftover-backup screen:** same `recovery.ts` view machinery
  (`leftoverPanel`), with Restore/Discard buttons and nested confirmation
  sub-steps (`restore-confirm`, `discard-confirm`) that reuse the same
  heading-focus-and-announce pattern. Structurally consistent with the
  unreadable-data screen.
- **Multi-tab stale banner and reload prompt:** the stale state reuses
  `#banner-region` (a `banner-error`-styled `<p>` plus a Reload button); the
  "Keep editing / Reload and discard" choice reuses the same `showChoiceDialog`
  native-`<dialog>` pattern as delete confirmation, with Escape mapped to the
  safe "Keep editing" choice (`banner.ts:58-67`). Same structural pattern and
  the same AT-specific open questions as the delete dialog above.

## 6. Findings list

Severity convention follows `code-review.md` (CRITICAL/HIGH/MEDIUM/LOW).

### MEDIUM

**F-1. PARTIALLY RESOLVED (2026-10-23, follow-up implementation task).** All
automated accessibility evidence (axe-core and keyboard) in this project was
originally collected only under Chromium, because `playwright.config.ts` had
no `projects` array and no Firefox build existed in the local Playwright
browser cache. This has now been remediated for the **automated** layer:
`npx playwright install firefox` was run (Playwright's own bundled Firefox
157.0 / build v1555, not a system/desktop install, downloaded to
`ms-playwright/firefox-1555`), and `playwright.config.ts` now declares a
`projects` array with a `chromium` project (`devices['Desktop Chrome']`) and
a `firefox` project (`devices['Desktop Firefox']`), so the existing suite
(including every axe-core check) now runs under both engines without any
change to the tests themselves, timeouts, retries, or the two-webServer setup.
`npx playwright test` was re-run: **238/240 passed** across both engines
combined — **120/120 passed under Chromium** and **118/120 passed under
Firefox**. The two Firefox-only failures are a genuine, honestly-reported new
sub-finding, not papered over: `tests/e2e/recovery.spec.ts` → "copy puts the
exact original on the clipboard" and `tests/e2e/csp.spec.ts` → "recovery
screen, Blob download and copy work on the built page under the CSP with no
violations" both fail only under the `firefox` project with `Error:
browserContext.grantPermissions: Unknown permission: clipboard-read` (at
`context.grantPermissions(['clipboard-read', 'clipboard-write'])`). This is a
Playwright-Firefox automation-driver limitation (the Firefox driver does not
support the `clipboard-read`/`clipboard-write` permission names that
`grantPermissions` accepts under Chromium), not a change in application
behaviour and not an axe-core/accessibility violation; the underlying "Copy
original data" feature itself is not shown to be broken in Firefox, only
that this test's permission-granting step is unsupported by Playwright's
Firefox driver. This test was left failing, not skipped, fixed, or deleted,
pending a decision from the orchestrator/user on how to treat it. Full
command took 2m29s for 240 tests (120 Chromium + 120 Firefox; previously
120 Chromium-only), i.e. roughly double the prior wall-clock duration, which
is an expected tradeoff of running two engines and was not mitigated by
reducing coverage.
Axe-core's checks are substantially browser-engine-independent, and the
automated evidence is now collected under both the Q-08 target browser
engine (Firefox, via Playwright automation) and Chromium. **This does not
close F-2 and does not, by itself, support any WCAG 2.2 AA conformance
claim**: F-2 (no genuine manual NVDA+Firefox testing has ever been
performed, with a real screen reader, on a real desktop Firefox) remains
open and is a separate, still-blocked gap — this task did not attempt it and
nothing here substitutes for it.

**Disposition (orchestrator record, 2026-10-23):** the 2 Firefox-only clipboard-permission e2e failures described above are **ACCEPTED as a documented tooling limitation**, per an explicit user decision relayed to the orchestrator - same category as CR-05/CR-13/CR-17/NFR-11. No fix is being made at this time; the tests are left failing (not skipped or deleted) as an honest, visible record of the known Playwright-Firefox driver gap. This disposition does not reopen F-1/F-2 or change any conformance statement.

**F-2. No genuine manual NVDA+Firefox testing has ever been performed on this
application** (carries forward DR-10, now with a concrete, checked technical
reason rather than only "unanswered Q-08/Q-15"). Several structural choices
documented in Section 5 — the live-region/focus-move combination on
recovery-step changes, the assertive-alert suppression logic on the "unsaved"
banner kind, and native-`<dialog>` focus-mode interaction — are exactly the
kind of thing that reads correctly in ARIA terms but has known
history of inconsistent screen-reader behaviour in practice, and none of
them has been verified with a real screen reader. This is not a defect by
itself; it is the reason no conformance claim can be made (Section 7).

### LOW

**F-3. No dedicated keyboard-only Playwright test exists for the banner
Retry button or the recovery panel's Restore/Discard/Reload buttons**
(Section 4). They are ordinary, natively-focusable `<button>` elements and
axe-core raises nothing, so this is a coverage gap in the test suite, not an
observed defect.

**F-4. The page `<title>` is static ("Contacts") across every view/state**,
including recovery and leftover-backup screens, which are substantially
different content states. For a screen-reader user who switches tabs/windows
and relies on the title to identify which page they returned to, a more
specific title (or no change, if the team decides a single-page app's static
title is acceptable) was not evaluated against real AT behaviour. Low
severity because this is a single-page app with no client-side routing, and
WCAG 2.2 does not require per-state title changes for an SPA that remains on
one logical page; flagged for awareness only.

**F-5 (carried forward, not newly found). CR-09's residual note — "not
verified with any assistive technology. Keep one mechanism and test with the
screen readers decided under Q-08" — remains open.** The code fix (reducing
`#live-assertive` to `role="alert"` only) is confirmed present in the current
`index.html`, but the verification CR-09 asked for still has not happened,
for the same reason as F-2.

No new CRITICAL or HIGH findings were identified in this pass beyond what
`code-review.md` already records (CR-12 resolved; CR-17 LOW, open, unrelated
to this task's scope and not re-verified here).

## 7. Non-conformance statement

**No WCAG 2.2 AA conformance claim is made for this application.** This is
explicit and unconditional, per NFR-08 and T-26's own acceptance criterion in
`impl-plan.md`. The automated axe-core pass (Section 3) found zero violations
across every required view/state, under Chromium, and the keyboard-operability
exercises (Section 4) and ARIA/semantic structure review (Section 5) found no
structural inconsistency with documented ARIA/HTML semantics — but automated
tooling and structural reasoning about markup are not a substitute for actual
human-performed assistive-technology testing, which has never been performed
on this application (Section 2, finding F-2). A conformance claim requires
genuine manual testing by a qualified human with real assistive technology,
which did not happen here and could not happen in this environment. This
assessment neither raises nor lowers the DR-10 MEDIUM finding's open status;
it documents, for the first time, a concrete and specific technical reason
(rather than only "Q-08/Q-15 unanswered") why the manual portion remains
undone, now that Q-08/Q-15 have in fact been answered.

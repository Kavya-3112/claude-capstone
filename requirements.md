# Requirements — Contact Management System

**Status: APPROVED by the user on 2026-10-22, with Q-08 and Q-15 open at that time; both have since been answered (recorded in `impl-plan.md` T-26), but NFR-07 and NFR-08 still cannot be closed, now for a different reason — see section 9.2.** Approval was given by the user ("i approve go ahead") in the main Claude Code session after being shown a summary of revision 2 of this file, and was recorded here by the main session on their behalf, not by the SDLC orchestrator. Scope: this file as revised (section 9, revision 2), including the interpretation in FR-48 that over-length input is rejected with a message and never truncated. Q-08 (supported browsers, devices, screen readers) and Q-15 (accessibility assessors and tools) have since been answered — Q-08: NVDA (screen reader) + Mozilla Firefox (browser), on Windows; Q-15: assessed by an implementation agent (not a human in this instance), combining the existing axe-core automated wiring with a markdown findings report (`accessibility-assessment.md`) — both recorded in `impl-plan.md` T-26. NFR-07 and NFR-08 still cannot be closed: not because these questions are open, but because the manual assistive-technology assessment they require was attempted and found technically blocked in the current environment (no NVDA installation, no real desktop Firefox installation; see `accessibility-assessment.md` findings F-1 and F-2). No approval of architecture.md is implied.

**Source:** `.claude/input/userstory.md` (US-01 to US-08). Every requirement below is derived from an acceptance criterion (AC) in that file. AC numbers are the 1-based order of bullets under each story. Nothing outside the source has been added. Where the source is silent, the gap is listed in section 9 and not resolved here.

## 1. Users and objectives
- **User (single role):** a person who manages a personal contact list in a web browser.
- **Objective:** add, view, edit, delete and search contacts (name and phone number), with data kept in browser local storage, safe from storage failures, and usable on desktop and mobile with accessible controls.

## 2. Scope
**In scope:** US-01 to US-08 (add, view, edit, delete, search, duplicate phone numbers, persistence and storage-error handling, accessibility and responsiveness).

**Out of scope (stated or implied by the source):**
- Phone extensions and letters in phone numbers (rejected).
- Uniqueness enforcement on phone numbers.
- Any contact field other than name and phone number.
- Any storage other than browser local storage. Server, sync and multi-device access are not mentioned.
- Any feature not in US-01 to US-08 (for example import/export, user accounts, groups). These are not mentioned and are not included.

## 3. Facts, assumptions, dependencies, constraints
**Facts (from input):**
- F1. The application runs in a browser and stores contacts in browser local storage (US-07 AC1).
- F2. Accessibility target is WCAG 2.2 AA (US-08 AC6).
- F3. Minimum viewport width is 320 CSS px (US-08 AC1).

**Decisions (confirmed by the user, "accept" of the defaults table; see section 9):**
- A1. The user is a single local user with no authentication (Q-12, confirmed).
- A2. Name and phone number are the only fields (Q-13, confirmed).
- `.claude/input/userstory.md` is the authoritative input (Q-16).

**Answered (Q-08 and Q-15; recorded in `impl-plan.md` T-26, not here as a Stage 1 decision):** Q-08 — NVDA (screen reader) + Mozilla Firefox (browser), on Windows. Q-15 — assessed by an implementation agent (not a human in this instance), combining the existing axe-core automated wiring with a markdown findings report (`accessibility-assessment.md`). These answers do not by themselves close NFR-07/NFR-08: the manual assistive-technology assessment NFR-07 calls for was attempted and found technically blocked in the current environment (see `accessibility-assessment.md` findings F-1 and F-2; section 9.2).

**Dependencies/constraints:**
- C1. Persistence depends on the same browser storage being retained (US-07 AC2). Data cleared by the user or browser is not recoverable by the system.
- C2. Technology and architecture choices beyond the above are deferred to Stage 2.

## 4. Functional requirements

### Add (US-01)
| ID | Requirement | Source |
|---|---|---|
| FR-01 | The system shall let the user add a contact by entering a name and a phone number. | US-01 AC1 |
| FR-02 | The system shall reject submission when the name or phone number is not provided (required fields). | US-01 AC2 |
| FR-03 | The system shall accept a phone number only if it contains 7 to 15 digits after removing permitted formatting characters. | US-01 AC3 |
| FR-04 | Permitted formatting characters are a leading `+`, spaces, hyphens, and parentheses. | US-01 AC4 |
| FR-05 | The system shall reject phone numbers containing letters or extensions. | US-01 AC5 |
| FR-06 | The system shall display a clear validation message when input is invalid, and shall not save the contact. | US-01 AC6 |
| FR-07 | A successfully added contact shall appear in the contact list. | US-01 AC7 |
| FR-08 | A newly created contact shall appear before older contacts. | US-01 AC8 |

### View (US-02)
| ID | Requirement | Source |
|---|---|---|
| FR-09 | The system shall display saved contacts in a contact list. | US-02 AC1 |
| FR-10 | Each listed contact shall display its name and phone number. | US-02 AC2 |
| FR-11 | The list shall show the newest contacts first. | US-02 AC3 |
| FR-12 | The system shall display an empty state when no contacts exist. | US-02 AC4 |
| FR-13 | Contacts shall remain available after a browser refresh. | US-02 AC5 |
| FR-14 | Contact information shall be displayed clearly on desktop and mobile screens. | US-02 AC6 |

### Edit (US-03)
| ID | Requirement | Source |
|---|---|---|
| FR-15 | The user shall be able to select an existing contact for editing. | US-03 AC1 |
| FR-16 | The edit form shall display the contact's currently saved name and phone number. | US-03 AC2 |
| FR-17 | The user shall be able to update the name and phone number. | US-03 AC3 |
| FR-18 | The system shall validate updated information before saving, using the same phone rules as FR-02 to FR-05. (Same rules as add confirmed, Q-02; see FR-49.) | US-03 AC4 |
| FR-19 | Invalid changes shall be rejected with a clear error message and the saved contact left unchanged. | US-03 AC5 |
| FR-20 | The user shall be able to cancel editing, leaving the saved contact unchanged. | US-03 AC6 |
| FR-21 | A successfully edited contact shall retain its existing position in the list. | US-03 AC7 |

### Delete (US-04)
| ID | Requirement | Source |
|---|---|---|
| FR-22 | The user shall be able to select a contact for deletion. | US-04 AC1 |
| FR-23 | The system shall request confirmation before permanently deleting a contact. | US-04 AC2 |
| FR-24 | Confirmed deletion shall remove the selected contact from the list. | US-04 AC3 |
| FR-25 | Cancelling deletion shall preserve the contact. | US-04 AC4 |
| FR-26 | Deleting one contact shall not affect other contacts. | US-04 AC5 |
| FR-27 | The system shall display the empty state when the last contact is deleted. | US-04 AC6 |

### Search (US-05)
| ID | Requirement | Source |
|---|---|---|
| FR-28 | The user shall be able to search contacts by name. | US-05 AC1 |
| FR-29 | The user shall be able to search by full or partial phone number. | US-05 AC2 |
| FR-30 | Name search shall be case-insensitive. | US-05 AC3 |
| FR-31 | Phone search shall ignore permitted formatting differences (spaces, hyphens, parentheses). | US-05 AC4 |
| FR-32 | Search results shall update to reflect the entered query. | US-05 AC5 |
| FR-33 | The system shall display a helpful message when no contacts match. | US-05 AC6 |
| FR-34 | Clearing the search shall restore the full contact list. | US-05 AC7 |

### Duplicate phone numbers (US-06)
| ID | Requirement | Source |
|---|---|---|
| FR-35 | The system shall permit multiple contacts with the same phone number. | US-06 AC1 |
| FR-36 | Each contact shall have a unique internal identifier. | US-06 AC2 |
| FR-37 | Editing or deleting a contact shall affect only that selected contact, including when others share its phone number. | US-06 AC3 |
| FR-38 | Contacts with identical phone numbers shall each remain individually searchable and accessible. | US-06 AC4 |
| FR-39 | The system shall not use the phone number as a unique contact identifier. | US-06 AC5 |

### Persistence and storage errors (US-07)
| ID | Requirement | Source |
|---|---|---|
| FR-40 | Contacts shall be stored in browser local storage. | US-07 AC1 |
| FR-41 | Saved contacts shall remain available after refreshing or reopening the browser, provided the same browser storage is retained. | US-07 AC2 |
| FR-42 | The system shall validate stored contact data before using it. | US-07 AC3 |
| FR-43 | If stored data is unreadable, the system shall attempt recovery without immediately overwriting the original stored data. (Meaning of "recovery" decided in Q-05; see FR-51.) | US-07 AC4 |
| FR-44 | Replacing unreadable stored data shall require explicit user confirmation. | US-07 AC5 |
| FR-45 | If saving fails, the changes made shall remain visible in the interface and the system shall clearly indicate that they are not saved. | US-07 AC6 |
| FR-46 | The system shall not indicate that a failed save succeeded. | US-07 AC7 |

### Requirements derived from user decisions (revision 2)
These clarify or extend the criteria above. Source column cites the story AC clarified and the decision (Q-nn). Items marked (interpretation) are the smallest testable reading of the decision and should be confirmed at approval.

| ID | Requirement | Source |
|---|---|---|
| FR-47 | Name and phone input shall be trimmed of leading/trailing whitespace before validation and saving. A name that is empty or whitespace-only after trimming shall be rejected. No character restrictions apply to names. | US-01 AC2, US-03 AC4; Q-01 |
| FR-48 | A name longer than 100 characters (after trimming) shall be rejected, and a phone input longer than 20 characters (including formatting characters) shall be rejected, each with a clear validation message and no save. Input shall not be silently truncated (interpretation). | US-01 AC6, US-03 AC5; Q-03 |
| FR-49 | Edit shall apply exactly the same name and phone rules as add (FR-02 to FR-05, FR-47, FR-48). | US-03 AC4; Q-02 |
| FR-50 | "Newest" shall be determined by a monotonically increasing creation sequence assigned at add time, so same-instant additions are ordered deterministically, edits never change position, and deleting then adding never reuses an earlier position. | US-01 AC8, US-02 AC3, US-03 AC7; Q-04 |
| FR-51 | If stored data is unreadable, recovery shall consist of: (a) salvaging valid records, (b) keeping a backup of the raw original value, and (c) letting the user copy or download the raw original. The original stored value shall not be replaced until the user explicitly confirms. | US-07 AC4, AC5; Q-05 |
| FR-52 | Stored data shall be validated per record (required fields, name and phone rules, unique ids). Valid records shall be kept and used; invalid records shall not be used and shall be reported to the user by count. | US-07 AC3; Q-06 |
| FR-53 | Failed-save handling (FR-45, FR-46) shall apply to all saves (add, edit, delete). The "not saved" indication shall persist until a later save succeeds, and the user shall be offered a Retry action. | US-07 AC6, AC7; Q-07 |
| FR-54 | Search shall use a single input. Name search is a case-insensitive substring match. Phone search is a substring match on digits after formatting is removed, ignoring a leading `+`. | US-05 AC1 to AC4; Q-09 |
| FR-55 | Contacts shall be editable and deletable from filtered search results. The search query shall not be persisted across reload, and shall not be cleared when a contact is added. | US-05, US-03, US-04; Q-10 |
| FR-56 | The system shall not warn about duplicate phone numbers, and shall permit contacts with identical name and phone. | US-06 AC1; Q-11 |
| FR-57 | When data is changed in another browser tab, the system shall warn the user and/or reload the data, so a stale tab does not silently overwrite newer data (exact mechanism is a Stage 2 decision). | US-07 (concurrency gap); Q-20 (architecture numbering) |

## 5. Non-functional requirements (US-08)
| ID | Requirement | Source |
|---|---|---|
| NFR-01 | The application shall support a minimum viewport width of 320 CSS px without unintended horizontal scrolling. | US-08 AC1 |
| NFR-02 | All interactive features shall be operable by keyboard. | US-08 AC2 |
| NFR-03 | Form fields shall have accessible labels and accessible validation messages. | US-08 AC3 |
| NFR-04 | Keyboard focus shall be visible and follow a logical order. | US-08 AC4 |
| NFR-05 | Dynamic updates and error messages shall be communicated appropriately to assistive technologies. | US-08 AC5 |
| NFR-06 | Text and interactive controls shall meet applicable WCAG 2.2 AA requirements. | US-08 AC6 |
| NFR-07 | The interface shall be assessed with automated accessibility checks and manual keyboard and screen-reader testing. | US-08 AC7 |
| NFR-08 | Accessibility conformance shall be reported only after the assessments in NFR-07 are completed. | US-08 AC8 |

### Non-functional requirements derived from user decisions (revision 2)
| ID | Requirement | Source |
|---|---|---|
| NFR-09 | Contact names and phone numbers shall be rendered as plain text, never interpreted as markup or script. No authentication is required (single local user). No clear-all-data function or privacy notice is required. | Section 8; Q-12 |
| NFR-10 | The interface shall be in English. Message wording is chosen at design time; no exact wording or localisation is required. | Q-14 |
| NFR-11 | The system shall support contacts with name and phone fields only, at a scale of hundreds of contacts. Behaviour at larger scale (for example near the browser storage quota) is not guaranteed. | Q-13 |

## 6. Acceptance criteria and expected outcomes (testable)
Each FR/NFR is verified by the pass condition below. Representative cases are listed; the full set of data values is to be defined in test design after the open questions are resolved.

| ID(s) | Test scenario | Expected outcome |
|---|---|---|
| FR-01, FR-07, FR-08 | Add "A" then "B" with valid phones. | Both appear in the list; B is above A. |
| FR-02, FR-06 | Submit with empty name; with empty phone; with both empty. | Submission rejected; a visible message identifies the problem; list and storage unchanged. |
| FR-03 | Phone with 6, 7, 15 and 16 digits (no formatting). | 6 and 16 rejected; 7 and 15 accepted. |
| FR-03, FR-04 | `+1 (555) 123-4567`; `555-123-4567`. | Accepted (digit count after removing formatting is in range). |
| FR-03 | `+` and formatting characters counted: e.g. `+1234567` (7 digits). | Accepted; `+` is not counted as a digit. |
| FR-05 | `555-CALL-NOW`; `5551234567 ext 12`; `5551234567x12`. | Rejected with a validation message. |
| FR-09, FR-10, FR-14 | Open list with several contacts at 320 px and at desktop width. | Name and phone shown for each, readable, no unintended horizontal scroll. |
| FR-11 | Add three contacts in sequence. | Displayed in reverse creation order (see Q-04). |
| FR-12, FR-27 | Open with no data; delete the only contact. | Empty state shown in both cases. |
| FR-13, FR-41 | Add contacts, reload page. | Same contacts and order shown. |
| FR-15 to FR-17 | Select a contact to edit. | Form is prefilled with saved values; changes can be made. |
| FR-18, FR-19 | Edit to an invalid phone or empty name, save. | Rejected with a message; the saved contact is unchanged after reload. |
| FR-20 | Change values then cancel. | Saved values unchanged. |
| FR-21 | Edit the middle contact of three. | It stays in the middle. |
| FR-22 to FR-26 | Delete: confirm dialog appears; cancel keeps contact; confirm removes only that one. | As stated; other contacts unchanged. |
| FR-28, FR-30 | Search "ali" for "Alice" and "ALI". | Alice matches regardless of case. |
| FR-29, FR-31 | Search "555123" and "(555) 123" against `555-123-4567`. | Contact matches. |
| FR-32, FR-33, FR-34 | Type a query, a non-matching query, then clear. | Results update; no-match message shown; full list restored on clear. |
| FR-35 to FR-39 | Add two contacts with the same phone; edit one; delete the other; search by that phone. | Both saved; each has a distinct internal ID; edit/delete affects only the selected one; search returns each existing one. |
| FR-42, FR-43, FR-44 | Place malformed data under the storage key, load app. | Data is validated; the original stored value is not overwritten on load; user must confirm explicitly before it is replaced. |
| FR-45, FR-46 | Simulate a storage write failure (for example quota exceeded or storage unavailable) during add/edit/delete. | Change stays visible; a clear "not saved" indication appears; no success indication is shown. |
| FR-47 | Add name `"  Ann  "`; add name `"   "`. | Saved as `Ann`; whitespace-only rejected with message. Name `<b>x</b>` accepted (no character restrictions). |
| FR-48 | Name of 100 and 101 characters; phone input of 20 and 21 characters (valid digits with spaces). | 100 and 20 accepted; 101 and 21 rejected with message, nothing saved, nothing truncated. |
| FR-49 | Run every add validation case through edit. | Identical accept/reject outcomes. |
| FR-50 | Add contacts in rapid succession; edit the oldest; delete the newest and add another. | Order is reverse creation order; edit does not move any contact; the new contact is first. |
| FR-51 | Load with unreadable stored value. | Valid records salvaged; raw value backed up and original unchanged until explicit confirmation; copy and download of raw value available. |
| FR-52 | Stored array with 3 valid and 2 invalid records (including duplicate id). | 3 contacts shown; message reports 2 invalid records by count. |
| FR-53 | Force write failure on add, on edit, and on delete; then restore storage and press Retry. | Each shows "not saved" and no success; indication persists across further actions until a save succeeds; Retry is offered; indication clears after successful save. |
| FR-54 | Search `ALI`, `ali` for "Alice"; `555123`, `(555) 123`, `+555` forms against `+1 555-123-4567`. | Name matches case-insensitively as substring; phone matches on digit substring, leading `+` ignored; one search box. |
| FR-55 | With an active search, edit and delete a result; add a non-matching contact; reload. | Edit and delete work from results; query remains in the box after add and results remain filtered; after reload the query is empty and the full list shows. |
| FR-56 | Add two identical name+phone contacts. | Both saved, no duplicate warning. |
| FR-57 | Open two tabs; change data in tab A; then act in tab B. | Tab B warns and/or reloads the data; tab A's change is not silently overwritten. |
| NFR-09 | Add name `<img src=x onerror=alert(1)>`. | Displayed literally; no script runs; no login required. |
| NFR-10, NFR-11 | Review UI language; load a few hundred contacts. | English; list, add, search remain usable. |
| NFR-01 | Load at 320 px width. | No horizontal scrolling caused by page content. |
| NFR-02, NFR-04 | Complete add, edit, delete, search using only the keyboard. | All operations possible; focus always visible; order logical. |
| NFR-03, NFR-05 | Trigger validation errors and list updates with a screen reader. | Labels are announced; errors and dynamic updates are announced. |
| NFR-06, NFR-07, NFR-08 | Run automated accessibility checks, manual keyboard and screen-reader tests. | A conformance statement is made only after all three are executed, with results recorded. |

## 7. Error and edge cases (from input)
- Invalid or missing name/phone on add or edit (FR-02, FR-05, FR-06, FR-19).
- Phone digit count at the boundary (6/7 and 15/16) (FR-03).
- Phone containing letters or extensions (FR-05).
- No contacts, last contact deleted, no search matches (FR-12, FR-27, FR-33).
- Contacts sharing a phone number (FR-35 to FR-39).
- Unreadable or invalid stored data (FR-42 to FR-44).
- Failed save (FR-45, FR-46).
- Cancelled edit or delete (FR-20, FR-25).

## 8. Security and privacy notes
The input states no security or privacy requirements. Facts that follow from the input: contact data (personal information) is held in plain browser local storage, and is accessible to anyone with access to that browser profile. Whether any further handling is needed (for example input sanitisation when displaying names, retention, clearing data) is not specified. Decision Q-12: single user, no authentication, escaped rendering, no clear-all or privacy notice (NFR-09).

## 9. Clarification questions: resolutions and open items
User replied "accept" to a table of proposed defaults (defaults as stated in `architecture.md` section 14), with the explicit decisions below. The document was subsequently approved by the user on 2026-10-22 (see the status line at the top); this reply alone was an answer to the questions, not that approval.

### 9.1 Resolved
| Q | Decision | Recorded as |
|---|---|---|
| Q-01 | Name: trimmed, non-empty, no character restrictions. | FR-47 |
| Q-02 | Edit uses the same rules as add. | FR-18, FR-49 |
| Q-03 | Name max 100 chars; phone input max 20 chars (including formatting). | FR-48 |
| Q-04 | Newest = monotonic creation sequence; edits never reorder. | FR-50 |
| Q-05 | Recovery = salvage valid records + raw backup + copy/download of raw data; replacement needs explicit confirmation. | FR-43, FR-44, FR-51 |
| Q-06 | Keep valid records; report invalid records by count. | FR-52 |
| Q-07 | All saves; indication persists until a later save succeeds; Retry offered. | FR-53 |
| Q-09 | Single input; name substring, case-insensitive; phone digit substring; leading `+` ignored. | FR-54 |
| Q-10 | Edit/delete from results; search not persisted; search NOT cleared on add (the architecture draft's clearing is dropped). | FR-55 |
| Q-11 | No duplicate warning; identical records allowed. | FR-56 |
| Q-12 | Single user, no authentication; escaped rendering; no clear-all or privacy notice. | NFR-09, A1 |
| Q-13 | Name and phone only; hundreds of contacts. | NFR-11, A2 |
| Q-14 | English; wording chosen at design. | NFR-10 |
| Q-16 | `.claude/input/userstory.md` is the authoritative input. | Source line |
| Q-20 | Warn/reload when another tab changes data. (Numbered in `architecture.md`; recorded here only because decided.) | FR-57 |

### 9.2 Still open
- **Q-08 (browsers, devices, screen readers): answered** (recorded in `impl-plan.md` T-26). Target pair: NVDA (screen reader) + Mozilla Firefox (browser), on Windows. Maximum viewport width and orientation remain unanswered (not part of the Q-08 answer as recorded).
- **Q-15 (accessibility assessment): answered** (recorded in `impl-plan.md` T-26). Assessor/tooling/report format: run via an implementation agent (not a human in this instance), combining the existing axe-core automated wiring with a markdown findings report, `accessibility-assessment.md`.
- **NFR-07 and NFR-08 still cannot be closed** — not because Q-08/Q-15 are open (they are now answered, above), but because the manual assistive-technology assessment NFR-07 calls for was attempted, per `accessibility-assessment.md`, and found technically blocked in the current environment: no NVDA installation, no real desktop Firefox installation, and no Firefox build even in the local Playwright browser cache (see that document's findings F-1 and F-2). `accessibility-assessment.md` makes no WCAG conformance claim, consistent with NFR-08.
- **Residual detail:** behaviour of a phone search query containing no digits (for example only `-`) is not decided; left to Stage 2 design and test design to propose.
- Q-17 to Q-19 and Q-21 to Q-23 are architecture questions, not addressed here.

### 9.3 Original question text (for reference; resolved items are superseded by 9.1)

1. **Name validation (US-01 AC2, US-03 AC4):** Is a name valid if it is non-empty? Is whitespace-only invalid? Are there character restrictions? Is leading/trailing whitespace trimmed before saving?
2. **Edit validation (US-03 AC4):** Do edits use exactly the same name and phone rules as add?
3. **Length limits:** Is there a maximum length for name, and for the phone input string (including formatting characters)? What should happen beyond it?
4. **"Newest first" (US-01 AC8, US-02 AC3):** Is "newest" determined by creation time, insertion order, or an ID? How are ties (same millisecond) handled? Is it based on creation time only, so edits never change order (consistent with US-03 AC7)?
5. **"Recovery" for unreadable data (US-07 AC4):** What does an attempted recovery consist of (for example partial parse, keeping valid entries, offering a backup copy of the raw data, restoring a prior copy)? What does the user see while recovery is attempted and if it fails? What are the options when the user is asked to confirm replacement (for example start empty), and may the user keep or export the original?
6. **"Validate stored data" (US-07 AC3):** What counts as valid stored data (structure, required fields, phone rules, unique IDs)? If some records are valid and some are not, are the valid ones used?
7. **Failed-save scope (US-07 AC6):** Which operations (add, edit, delete) must show the not-saved state? Can the user retry? How long does the "not saved" indication persist? What happens on reload (the unsaved changes are lost)? Are specific failure causes (quota, disabled storage, private mode) in scope?
8. **Supported browsers and devices (US-08 intro, US-07):** Which browsers and versions, and which screen readers/OS combinations, are supported for testing? Is there a maximum viewport width or orientation requirement?
9. **Phone matching in search (US-05 AC2, AC4):** Is partial phone matching a substring match on the digits after formatting is stripped? Is a leading `+` ignored in searches? What if the query contains no digits (for example only formatting characters)? Is name search a substring match? Is search applied to name and phone together with a single input box, or are there separate inputs? Are accented/Unicode characters in case-insensitivity in scope?
10. **Search and other actions:** Can a contact be edited or deleted from filtered results? Should the search persist across refresh? Does a newly added contact that does not match the active search appear?
11. **Duplicates (US-06):** Should the system warn about, or be silent on, duplicate phone numbers? Are fully duplicate contacts (same name and phone) permitted?
12. **Security/privacy:** Are there any requirements for the handling of personal data in local storage (for example sanitised rendering, a clear-all-data function, privacy notice)? Is a single user with no authentication the intended model (A1)?
13. **Contact fields (A2):** Are name and phone the only fields, and is an empty list size or maximum number of contacts expected (performance/scale expectations)?
14. **Empty-state and messages:** Is exact wording required for validation, empty, no-match, delete-confirmation and not-saved messages, and is a localisation/language requirement needed?
15. **Accessibility assessment (NFR-07, NFR-08):** Which automated tools and screen readers are required, who performs the manual testing, and what format should the conformance report take?
16. **Input location:** The workflow instructions refer to `.github/input/userstory.md`, but the supplied input is at `.claude/input/userstory.md`. Please confirm the latter is the authoritative source.

## 10. Traceability summary
| Story | Requirements |
|---|---|
| US-01 | FR-01 to FR-08, FR-47, FR-48, FR-50 |
| US-02 | FR-09 to FR-14, FR-50 |
| US-03 | FR-15 to FR-21, FR-47 to FR-50 |
| US-04 | FR-22 to FR-27, FR-55 |
| US-05 | FR-28 to FR-34, FR-54, FR-55 |
| US-06 | FR-35 to FR-39, FR-56 |
| US-07 | FR-40 to FR-46, FR-51 to FR-53, FR-57 |
| US-08 | NFR-01 to NFR-08 |
| Decisions only (no single AC) | NFR-09 to NFR-11 |

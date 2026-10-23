# Design Review - Contact Management System

**Status: PROVISIONAL (revision 3; re-validated against the current requirements.md and architecture.md). Not approved. Not a gate-clearing review.**

**Why the PROVISIONAL label stays:**
- The approval evidence is the status line (line 3) of each file. Each says the user approved ("i approve go ahead") in the main session and that the main session recorded it on the user's behalf, not the SDLC orchestrator.
- I can't independently verify that the user said this or which version they saw. The records were written by an agent, not by the user or the Orchestrator.
- `.github/sdlc-status.md` still does not exist, so there is no orchestrator record.
- The earlier contradiction in the files is mostly fixed (see DR-18), but approval is still not verified. Whether to treat these in-file records as sufficient is a decision for the Orchestrator or the user, not for me.
- The risk acceptance recorded in architecture.md for DR-02 is also relayed and unverified. This review does not accept any risk on the user's behalf.
- Nothing here approves the design review.

**Inputs reviewed:** `requirements.md` (FR-01..FR-57, NFR-01..NFR-11), `architecture.md` (sections 1-17), `.claude/input/userstory.md`. Both files were re-read in full for this revision.
**Limits:** document-based only. No code or tests exist or were run. "Resolved in design" means the documents describe a mitigation. It does not mean the mitigation is implemented or verified.

## 1. Requirement coverage
- The FR and NFR items still match the user-story criteria. FR-47..FR-57 and NFR-09..NFR-11 are recorded user decisions.
- The traceability table (architecture section 13) now maps every FR and NFR, including FR-47..FR-57 and NFR-09..NFR-11.
- The test strategy (section 10) now covers them, including two-tab E2E and the boundary cases.
- No missing requirement was found.
- FR-51(b) keeps a raw backup, while Q-23 deletes the backup key after the user confirms the replacement. After that, the user's own copy or download is the only copy of the original. The wording is compatible, but the user should know it.

## 2. Status of every finding
| ID | Earlier | Now | Basis |
|---|---|---|---|
| DR-01 Recovery backup | MEDIUM | Open, LOW | The Q-23 reading and the step 3 reading are recorded as approved with the document (status line). Remaining: a leftover backup key versus a newly found corruption. Section 6 step 5 says the backup is "overwritten only by a later recovery", with no ordering defined. Step 3 and "Still open" still say "wording to be checked". |
| DR-02 Multi-tab | MEDIUM | Open, LOW | Section 6a keeps the `storage` event, the staleness check and Reload. The near-simultaneous-write race is recorded as accepted by the user via a relayed reply (6a, R-B). I can't verify that acceptance. Not addressed: the staleness-check baseline when storage was unavailable at load. |
| DR-03 Reliance on open questions | resolved | Resolved in design | Only Q-08 and Q-15 and the host remain open. |
| DR-04 Schema consistency | addressed | Resolved in design | The sequence rules and the collision rule are consistent. |
| DR-05 | resolved | Resolved in design | Q-21 and Q-22 decided. R-F usability risk is documented. |
| DR-06 | resolved | Resolved in design | The query is never cleared (FR-55). |
| DR-07 Length limits | addressed | Resolved in design | The test strategy now says no HTML `maxlength`. The character-counting definition (UTF-16 units or code points) is still open as an implementation detail. |
| DR-08 Hosting and CSP | MEDIUM | Open, LOW | The host is deferred to planning. Lowered because the primary XSS control is `textContent`; CSP is defence in depth. A meta-CSP cannot express every directive. |
| DR-09 Dependencies | LOW | Open, LOW | Pinning and a lockfile are planning tasks. |
| DR-10 Accessibility assessment | MEDIUM | Open, MEDIUM | Q-08 and Q-15 are unanswered. NFR-07 and NFR-08 can't be closed. Approval "with Q-08 and Q-15 open" is not an explicit risk acceptance. |
| DR-11 | resolved | Resolved in design | FR-54 covers it. |
| DR-12 Locale-aware lowercasing | LOW | Open, LOW | Section 5 still says "locale-aware lowercasing". Not changed. |
| DR-13 UUID fallback | LOW | Open, LOW | The fallback and the existing-id check are unspecified. |
| DR-14 Banner text | addressed | Resolved in design | Section 6 says the banner states that earlier unsaved changes are included. To be verified when built. |
| DR-15 Reload discards pending edit | MEDIUM | Resolved in design | Section 6a: Reload with a pending edit asks "Keep editing" or "Reload and discard". Nothing is discarded without the explicit choice. No merge is offered, which is an accepted trade-off of the option chosen. |
| DR-16 Salvage tie-break | LOW | Resolved in design | Section 6: the first record in stored order is kept and later collisions are counted as invalid. Test case added. |
| DR-17 Hidden-by-search notice | LOW | Resolved in design | Section 5: a visible message plus a live-region announcement. |
| DR-18 Approval records | MEDIUM | Partially resolved, LOW | See section 3. |
| DR-19 Traceability and tests | LOW | Resolved in design | Section 13 and section 10 now cover FR-47..FR-57 and NFR-09..NFR-11. |

New findings in this revision: none.

Open counts: CRITICAL 0, HIGH 0, MEDIUM 1 (DR-10), LOW 7 (DR-01, DR-02, DR-08, DR-09, DR-12, DR-13, DR-18).

## 3. DR-18: is the approval-record contradiction resolved?
Partially.
- Resolved: architecture.md section 17 now matches the status line, and the requirements section 9 line about the status remaining PROPOSED was corrected (line 208). The explicit contradictions I reported earlier are gone.
- Not resolved:
  - The records were still written by the main session, not the Orchestrator. There is no `.github/sdlc-status.md`.
  - Architecture lines 3, 5 and 7 still carry older text. Line 3 says `design-review.md` "is stale", which this revision supersedes. Line 7 says the relayed reply is "not approval of this document or of `requirements.md`", with no "historical" label (line 5 has one). Section 16 also says "no finding is closed by this document". These are mild and can mislead a reader.
- Action: the Orchestrator should verify and record the approvals. The document owners can tidy the older text.

## 4. Category assessment
| Category | Result |
|---|---|
| Requirement coverage | No finding. |
| Integration gaps | No finding (client-only, no external integrations). |
| Scalability and maintainability | DR-02 (race, no locking), DR-09. Scale is hundreds of contacts (NFR-11, decided). |
| Security and privacy | DR-08. The design documents escaped rendering, CSP, and no third-party scripts. Nothing is verified. |
| Reliability and error handling | DR-01, DR-02. |
| Technology choices and dependencies | DR-09, DR-12, DR-13. |
| Testability | No open finding. The StorageAdapter and the expanded test plan support the requirements. |
| Deployment | DR-08. `file://` is unsupported (documented). Origin-scoped data (section 12). |

## 5. Feasibility
A static client-only app using localStorage is feasible. The highest-complexity areas are recovery and multi-tab handling. No feasibility blocker was identified. This is a document-based judgement only.

## 6. Unresolved risks and decisions needed
- Approval evidence is relayed and in-file only (DR-18). Verify and record it.
- Q-08 and Q-15 are unanswered (DR-10). No accessibility conformance claim is possible.
- The host and its header capability are unknown (DR-08).
- The recorded acceptance of the DR-02 race is relayed and unverified.
- Remaining design details for planning: leftover-backup ordering, the staleness baseline, lowercasing, UUID fallback, version pinning.
- Everything is design-level. Nothing is built or tested.
- Stage 4 must not start until the gates in `claude-instruction.md` are met, including resolution or explicit user acceptance of the residual risks here.

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

This project has not yet been placed under version control and has not been released; the version number below (`0.1.0`) is taken as-is from the existing `package.json` because it is the obvious candidate, not because a release has occurred. No release date is recorded for a version; only the date this entry was written is given.

## [Unreleased] - entry written 2026-10-23

### Added

- Initial implementation of a client-only contact management web app: add, view, edit, delete, and search contacts by name or phone number, with no backend, accounts, or network calls at runtime.
- Local persistence to the browser's `localStorage`, including schema validation of stored data, salvage/recovery handling for unreadable (corrupted) stored data with explicit user confirmation before any replacement, and a leftover-backup restore/discard flow.
- A save-status banner that reports failed saves (for example, storage quota exceeded, or storage unavailable/private-browsing "memory-only" mode) with a Retry action.
- Cross-tab awareness: a tab detects when another tab has changed the underlying stored data and offers a safe reload prompt rather than silently overwriting newer data.
- Search by name (case-insensitive substring) and by phone number (formatting-insensitive, ignoring a leading `+`).
- A build-time Content-Security-Policy, injected into the production build only, confirmed present in the built `index.html`.
- `README.md` with install, development-server, production-build-and-serve, and test instructions, plus documented storage, security, and deployment caveats.
- `traceability-matrix.md` mapping all 57 functional requirements and 11 non-functional requirements to their covering tests (or to a named, honest gap where no test exists).
- `accessibility-assessment.md` documenting automated accessibility results (axe-core, 0 violations across every required view/state under both Chromium and Firefox via Playwright automation) and genuine keyboard-only operability tests, while explicitly stating that manual assistive-technology testing (NVDA + Firefox) could not be performed in the build environment and is not claimed.

### Known limitations

- No WCAG 2.2 AA conformance claim is made. Automated accessibility checks are clean, but manual assistive-technology testing has never been performed on this application.
- Two Playwright end-to-end tests fail only under the Firefox test engine (`recovery.spec.ts`, `csp.spec.ts`), due to a confirmed Playwright-Firefox driver limitation around clipboard permission names, not an application defect. Left failing (not skipped or deleted) as an honest, visible record.
- No scale/load test exists for larger contact lists (a few hundred contacts); accepted as a residual risk without a test at this time.
- A small number of narrow, low-severity UX edge cases around mutation-blocked states are known and accepted rather than fixed (see the project's `code-review.md` for CR-05, CR-13, CR-17).
- No hosting provider has been chosen and no deployment or CI configuration exists in this repository; only local build/serve/test instructions are provided.
- A host-delivered Content-Security-Policy response header and a dedicated `innerHTML`-usage audit remain outstanding; only the build-time CSP `<meta>` tag mechanism is implemented and tested.

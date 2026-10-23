# Contact Management

A client-only contact management web app: add, view, edit, delete and search contacts
(name and phone number). There is no backend, no accounts and no network calls at
runtime; all data is kept in the browser.

## Prerequisites

- Node.js and npm. The project does not pin a Node version in `package.json`
  (no `engines` field), but it was built and verified with Node v26.10.0 /
  npm 11.19.1. Any reasonably current Node.js LTS release should work; TypeScript
  is compiled with an `ES2022` target (see `tsconfig.json`).
- No other runtime dependency. The app has no server, database, API keys or
  environment variables.

## Install

```
npm install
```

## Development server

```
npm run dev
```

Starts the Vite dev server (default `http://localhost:5173`). The dev server does
**not** inject the production Content-Security-Policy (see "Security" below).

## Build and serve a production build locally

Build static files:

```
npm run build
```

This runs `tsc --noEmit` followed by `vite build` and writes static assets to
`dist/`.

The build output must be served over `http(s)://`; opening `dist/index.html`
directly via a `file://` URL is **not supported** (browsers commonly block
ES module scripts under `file://`, and this app relies on a bundled module
build). To serve the build locally over HTTP, use Vite's built-in preview
server:

```
npx vite preview --port 4173 --strictPort
```

Then open `http://localhost:4173/` in a browser. This was verified directly
while implementing this documentation: `npm run build` completed successfully,
`npx vite preview --port 4173 --strictPort` was started, and
`curl http://localhost:4173/` returned HTTP 200 with the built `index.html`,
including the injected `Content-Security-Policy` `<meta>` tag.

Any other static file server over HTTP (for example `npx serve dist`) works
as well; `vite preview` is used above because it is already a dependency of
this project and is the same server the Playwright end-to-end suite uses for
production-build tests (see `playwright.config.ts`).

## Running tests

Unit tests (Vitest, pure domain/storage logic, no browser):

```
npm run test
```

End-to-end and accessibility tests (Playwright, including axe-core checks):

```
npm run test:e2e
```

If Playwright's browsers are not already installed on this machine, install
them first:

```
npx playwright install
```

Per `playwright.config.ts`, the e2e suite automatically starts two local
servers for the duration of the run: the Vite dev server on port 5173, and a
production build served with `vite preview` on port 4173 (so CSP-dependent
tests run against the real built, policy-bearing HTML). You do not need to
start either server yourself before running `npm run test:e2e`.

Type-checking only, without emitting or bundling:

```
npm run typecheck
```

## Data and storage notes

- Contacts are stored in the browser's `localStorage`, under a single key
  scoped to the origin (protocol + host + port) the app is served from.
- Because storage is origin-scoped, serving the app from a different origin
  or port (for example `http://localhost:4173` instead of
  `http://localhost:5173`, or a different hostname) shows an **empty**
  contact list, not a deleted one. The data saved under the previous origin
  is still there; it is simply not visible from a different origin.
- Data is stored in **plaintext** in the browser's profile. It is not
  encrypted, and is readable by anyone with access to that browser profile
  (or by any script able to run on the same origin).
- Clearing the browser's site data / local storage for this origin
  **permanently deletes** the saved contacts. There is no server-side or
  other backup, and this cannot be undone by the application.
- `file://` is not supported. The app must be served over `http://` or
  `https://` (see "Build and serve a production build locally" above).

## Security

A Content-Security-Policy is injected automatically into the **production
build only** (not the dev server), via a Vite build plugin. See the `CSP`
constant and the `inject-csp-meta` plugin in `vite.config.ts` for the exact
policy and the reasoning (a `<meta>` tag cannot express every directive,
such as `frame-ancestors`; a host-delivered header is preferred once a host
is chosen).

## Deployment status

No hosting provider has been chosen, and **no deployment is performed by
this project at this time**. This repository only documents how to build
static files (`npm run build` → `dist/`) and how to serve them locally over
HTTP for verification; it does not include any deployment configuration or
instructions for a specific host. The choice of host, and the related
question of whether that host can deliver the Content-Security-Policy as a
response header (rather than only the build's `<meta>` tag), are open items
tracked in `impl-plan.md`.

## Continuous integration

There is no CI pipeline in this repository. Builds, type-checking and tests
are run locally using the npm scripts above.

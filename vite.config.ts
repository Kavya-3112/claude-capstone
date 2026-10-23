import { defineConfig } from 'vitest/config';

/**
 * Content-Security-Policy for the built app (CR-04, decision 9). Injected only
 * by `vite build`: the dev server injects inline scripts for hot reload, which
 * this policy would block. A meta tag cannot express every directive (for
 * example `frame-ancestors`); a response header is preferred once the host is
 * chosen (DR-08, T-24). If a later task adds a Blob download (T-20), re-check
 * that this policy still allows it.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

export default defineConfig({
  plugins: [
    {
      name: 'inject-csp-meta',
      apply: 'build',
      transformIndexHtml: {
        order: 'post',
        handler(html: string) {
          const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
          return html.replace('<head>', `<head>\n    ${meta}`);
        },
      },
    },
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});

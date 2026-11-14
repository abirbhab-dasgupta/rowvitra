# Rowvitra — Implementation and Test Report

**Date:** November 14, 2026  
**Scope:** Locally executed validation of the supplied application source. This is **not** a claim of verified live production deployment.

## Automated checks run

| Check | Result | Evidence / limitation |
|---|---|---|
| Python unit tests | **PASS — 36 tests** | `PYTHONPATH=services/processor python -m pytest -q services/processor/tests` |
| Internal FastAPI request tests | **PASS** | Included in 36 tests; verify authorized requests, unauthorized requests, invalid operations |
| CSV integrity and repair engine | **PASS** | Identifier leading zeros, protected casts, duplicate detection, deterministic cleaning, unsafe fills, reviewable diffs |
| Chart computation | **PASS** | Chart aggregation, source-row lineage, chart filters, and validation for unsupported filters |
| Data rules, version-friendly previews | **PASS** | Existing-rule preservation, rejection of worsening rule violations, recipe replay drift checks |
| Python export replay | **PASS** | Generated Python script executed in a subprocess; output exactly matches previewed CSV |
| Five seeded corruption fixtures | **PASS — smoke fixtures only** | 5 detections, 2 attempted safe repairs, 2 correctly repaired, 3 abstentions. These are **synthetic**, not public-dataset or Gemini accuracy benchmarks. |
| TypeScript/TSX parse diagnostics | **PASS — 43 source modules, 0 syntax errors** | Global TypeScript compiler API performed syntax-only parsing, **not** typechecking or bundling |
| Browser E2E test files | **WRITTEN — NOT RUN** | Requires installed npm packages and an available Next.js server; `tests/e2e/` contains Playwright tests |
| `npm install`, typecheck, lint, Next production build | **NOT RUN** | npm registry DNS resolution was unavailable in the authoring environment |
| Cloudinary raw-authenticated upload/download | **NOT RUN** | Requires your actual Cloudinary credentials |
| Better Auth + Neon migrations + Google OAuth | **NOT RUN** | Requires real database and OAuth credentials |
| Live Gemini structured-output requests | **NOT RUN** | Requires API key and quota; deterministic fallback tested |
| Vercel two-service deployment | **NOT RUN** | Requires your Vercel project and environment variables |

## Important configuration notes

- The application restricts initial CSV size to **1.5 MB** and does not promise arbitrary dataset sizes on Vercel Functions.
- The public, login-free `/demo` processing API is **disabled by default**. Only enable for controlled local testing; a production public demo requires rate limiting.
- The app does not run arbitrary Gemini-generated code. Operations are validated against a fixed Python whitelist.
- CSV cell content is preserved even if it resembles spreadsheet formulas. Warn users before opening untrusted CSV exports in Excel-like software.
- The frontend dependency versions were checked against official npm results, but dependency compatibility is **not proven** until `npm install && npm run typecheck && npm run build` succeed.
- The uploaded HTML reference's artwork is reused from supplied embedded assets. Browser-level visual regression comparison of Next pages is not yet run.

## Required acceptance gate before public launch

1. Install Node dependencies on an internet-connected development machine and commit generated `package-lock.json`.
2. Run `npm run typecheck`, `npm run lint`, and `npm run build`; fix any failures introduced by actual package types.
3. Run the Python tests and install Playwright Chromium, then run `npm run test:e2e`.
4. Configure Neon and Better Auth; verify registration, sign-in, sign-out, Google callback (no recovery or verification email in this build) with real credentials.
5. Configure Cloudinary; verify raw authenticated CSV upload, signed read, leading-zero preservation, and access denial for a second user.
6. Enable Gemini with a real key; confirm structured responses, fallback, validation, and rate/cost controls.
7. Test all Vercel routes, maximum request sizes, cold starts, function execution limits, private CSV downloads and export replay.
8. Confirm every accepted edit updates saved data and charts, and stale commits respond 409.

**Status:** substantial functional implementation, backend-tested and ready for environment-specific integration work; **not certified production-ready**.


## Visual redesign and regression checks (November 14, 2026)

- The landing copy, scene compositions, section order, product artwork, and color palette were aligned with the user-provided screenshot. Orange emphasis is applied to “shouldn’t be”, “clarity”, and “refine”. The additional promotional section was removed to keep the supplied composition.
- The same ivory, charcoal and orange design system was applied across authentication, the dashboard, and workspace surfaces. A local static Chromium preview was evaluated at 390, 768, and 1024 CSS-pixel widths; no horizontal overflow was detected at those widths. This is a CSS/markup visual inspection, not a live Next.js render.
- Animations use opacity/transform, with reduced-motion overrides. A client-side IntersectionObserver triggers scroll reveals only when available.
- Email recovery and verification pages, related UI links, email provider helper and environment variables were removed. Google sign-in and email/password sign-in remain.
- 36 Python tests passed, including new duplicate/blank CSV header and BOM/leading-zero tests.
- 41 TS/TSX modules parsed without syntax errors using the available TypeScript compiler API; internal `@/` imports resolved. Both CSS stylesheets passed CSS token parsing.
- **Not verified:** npm package install, TypeScript type checking against actual dependencies, Next.js production build, Playwright against a live Next.js server, or external-service credentials. Those require an environment with npm registry access and real provider credentials.

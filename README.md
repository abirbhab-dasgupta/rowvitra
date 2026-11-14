# Rowvitra

**From Raw Data to Reliable Insights.** A full-stack AI-assisted data preparation and visual analytics workspace.

Rowvitra connects dataset profiling, goal-aware issue ranking, Gemini proposals, whitelisted pandas transformations, before/after previews, human approvals, an interactive Plotly chart builder, editable cells, immutable dataset versions, rule checks, and reproducible CSV/Python/audit exports.

**UI design:** Adapted to the supplied Rowvitra website screenshot and its HTML artwork. The six WebP illustrations are retained in `public/images/`. The landing page, auth pages, dashboard, and editing workspace use an ivory, charcoal, orange editorial SaaS identity. Motion relies on lightweight CSS transitions and scroll reveals, respects reduced-motion preferences, and is progressively enhanced.

## Architecture

| Layer | Implementation |
|---|---|
| Frontend & private API | Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 |
| Authentication | Better Auth (email/password, Google OAuth, no reset email or verification screens) |
| Accounts & history | Neon PostgreSQL + Drizzle ORM |
| Private CSV storage | Cloudinary raw **authenticated** assets |
| Processing service | FastAPI + pandas + NumPy on a second Vercel project |
| AI planner | Gemini `google-genai`, schema-constrained suggestions |
| Charts | Plotly.js 4 with source-row click inspection; map uses `scattergeo` |
| Deployment | Two Vercel projects sourced from one Git repository |

No `src/` directory. All `app/`, `components/`, `lib/`, `db/` folders are at the repository root.

More implementation detail: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**. Test limitations: **[docs/TEST_REPORT.md](docs/TEST_REPORT.md)**.

## Key workflows

1. **Upload** a CSV (MVP limit 1.5 MB, 10,000 rows, 100 columns); original and subsequent snapshots stay separate.
2. **Diagnose** missing data, exact duplicates, inconsistent categories, mixed types, possible negative values. Protect ID/phone/PIN/postal fields and leading zeros.
3. **Prioritize** issues relevant to an analysis goal.
4. **Plan** suggested repairs with Gemini (or explicit, visibly labeled deterministic fallbacks without an API key).
5. **Preview** a batch. See exact affected cells, row changes, before/after numeric aggregates, and optional chart impact.
6. **Approve** after automatic data-rule retesting. Stale-version checks prevent silently applying outdated proposals.
7. **Explore** via interactive grid and Plotly chart builder (bar, line, pie, scatter, histogram, box, heatmap, geographic points). Filter, aggregate, click source rows, and edit cells.
8. **Export** processed CSV, audit JSON, and deterministic Python script. The Python processor checks script replay output before returning a generated script.
9. **Replay** an approved recipe against a second CSV in preview-only mode and inspect drift warnings.

All numeric chart values come from pandas, not from Gemini. The model never supplies executable Python/JavaScript code.

## Getting started

Read **[docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)** for the complete Windows/macOS/Linux setup, database migration, Google OAuth, Cloudinary, Gemini, authentication configuration, and both Vercel deployments.

Quick local flow after configuring credentials:

```bash
# Terminal 1 — Python processor
cd services/processor
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
# Copy services/processor/.env.example to services/processor/.env
# Set PROCESSOR_SERVICE_TOKEN and GEMINI_API_KEY in services/processor/.env
uvicorn app:app --reload --port 8000 --env-file .env

# Terminal 2 — Next.js frontend from repo root
npm install
# Fill .env.local (see .env.example)
npm run db:push
npm run dev
```

For a local, login-free demo set `ENABLE_PUBLIC_DEMO=true` in `.env.local`, then visit `/demo`. This uses synthetic example data and deterministic suggestions; **do not enable this route on a public production deployment without abuse protection**.

## Test commands

```bash
PYTHONPATH=services/processor python -m pytest -q services/processor/tests
PYTHONPATH=services/processor python benchmarks/evaluate.py
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

The revised Python unit/API suite passed 36 tests, including duplicate-header protection, and the fixture benchmark was run in the authoring environment. The npm registry was unreachable there; therefore the Next.js package install/build and live Cloudinary, Google OAuth, Neon, and Gemini requests **have not been end-to-end validated**. TypeScript/TSX syntax and local imports were checked, but that is not a substitute for a full production build. See **[docs/TEST_REPORT.md](docs/TEST_REPORT.md)** before deploying. Dependency versions were selected from official npm sources as of November 14, 2026; create a lockfile with `npm install` in an environment with registry access.

## Security and limitations

- Per-user dataset ownership is checked by authenticated Next.js API routes. FastAPI requires an internal token and must not be exposed with that token to browsers.
- Files use authenticated Cloudinary delivery, with server-only signed access. Original data is preserved.
- CSV is parsed into string columns first, protecting leading-zero identifiers. Explicit manual edits remain reviewable.
- Python executes a **fixed whitelist of operations**, not model-generated code.
- Gemini receives column types, quality counts, and minimal metadata, not the entire CSV for its planning step. Verify API data handling terms before uploading sensitive files.
- File size and function duration limits are intentionally conservative for a serverless MVP.
- The synthetic 5-fixture benchmark is a smoke test, **not** a measured generalization claim or comparison to competing AI systems.
- This is a substantial codebase, not a production security audit. Test and harden before accepting confidential or regulated datasets.

## Authentication scope

This build deliberately removes email recovery/reset pages and email verification. Users can sign up with email/password or sign in through configured Google OAuth; changing a known password remains possible in settings. Lost-password self-service recovery is not included.

## License

Educational/hackathon prototype. The user-supplied artwork belongs to its original creator. Third-party libraries retain their respective open-source licenses.

# Rowvitra — Final Setup, Testing & Vercel Deployment Guide

**Applies to:** `Rowvitra_Full_Project.zip` (November 14, 2026 project build)  
**Architecture:** Next.js web app + FastAPI processor, Neon PostgreSQL, Better Auth, Cloudinary authenticated CSV storage, Gemini API, Plotly.js.  
**Development OS:** Windows PowerShell, macOS, or Linux.  
**Status:** Python automated tests passed locally; full web build and live provider integration remain to be verified with your own credentials.

## 1. What you are setting up

The same Git repository contains two applications:

| Application | Directory | Local address | Vercel project |
|---|---|---|---|
| Rowvitra web | repository root (`rowvitra/`) | `http://localhost:3000` | `rowvitra-web` (suggested name) |
| Rowvitra processor | `services/processor/` | `http://localhost:8000` | `rowvitra-processor` (suggested name) |

The **web** app owns Better Auth sessions, Neon records, user/data permissions, and Cloudinary uploads and reads. The **Python** app performs profiling, chart queries, deterministic repairs, verification, exports, and Gemini AI calls. The web app calls Python with a secret `X-Processor-Token` header. The browser must never receive this token.

### Prerequisites

- Node.js **22 LTS** (npm 10 or newer recommended).
- Python **3.12** (matches the processor's `.python-version`; Python 3.13 also worked in local tests).
- Accounts: **Neon**, **Cloudinary**, **Google AI Studio/Gemini**, **Vercel**.
- Optional: Google Cloud OAuth credentials (for Google sign-in). Password recovery and email verification UI are intentionally excluded.
- A terminal, Git, and an editor such as VS Code.

The app restricts CSV uploads to **1.5 MB** (and the processor imposes row/column limits). Do not assume the current serverless design is intended for very large or sensitive datasets.

## 2. Extract the ZIP and install dependencies

The ZIP is named **`Rowvitra_Full_Project.zip`** and contains a top-level `rowvitra/` folder. Extract it, then enter that folder.

**Windows PowerShell** (run from the folder containing the ZIP):

```powershell
Expand-Archive .\Rowvitra_Full_Project.zip -DestinationPath .\Rowvitra_Source
cd .\Rowvitra_Source\rowvitra
node --version
npm --version
npm install
Copy-Item .env.example .env.local
```

**macOS/Linux:**

```bash
unzip Rowvitra_Full_Project.zip -d Rowvitra_Source
cd Rowvitra_Source/rowvitra
node --version
npm --version
npm install
cp .env.example .env.local
```

`npm install` creates `package-lock.json`. Keep and commit it after dependency installation succeeds. The supplied archive intentionally does **not** include `node_modules` or a validated lockfile.

## 3. Create the Neon database

1. Create a Neon PostgreSQL project and database.
2. Copy the PostgreSQL connection string from Neon, preferably the pooled connection for the deployed Node.js app.
3. Paste it into **`rowvitra/.env.local`** as `DATABASE_URL`. Preserve URL escaping for special password characters. Use the provided SSL parameters.
4. Keep this URL **server-only**; never use a `NEXT_PUBLIC_` prefix.

Example (replace the entire value with your actual Neon URL):

```dotenv
DATABASE_URL=postgresql://user:password@your-neon-pooler-host/dbname?sslmode=require
```

### Create the database tables

The project defines Better Auth and Rowvitra tables in `db/schema.ts` and has a Drizzle Kit `db:push` script.

**Important:** The provided `drizzle.config.ts` reads `process.env.DATABASE_URL` directly. The Drizzle CLI may **not** automatically load Next.js `.env.local`. Expose `DATABASE_URL` in your current terminal before running its commands.

**Windows PowerShell** (from the repository root):

```powershell
$line = (Get-Content .env.local | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
$env:DATABASE_URL = $line.Substring('DATABASE_URL='.Length).Trim('"')
npm run db:push
```

**macOS/Linux** (from the repository root):

```bash
export DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | head -1 | cut -d= -f2-)"
npm run db:push
```

Only run `db:push` against a database you intend to initialize or update. Review schema changes before pushing to any database with important existing data. The project also has `npm run db:generate` for producing migration SQL; it does **not** provide a `db:migrate` npm script.

## 4. Set up Better Auth

Better Auth is already connected to Next.js via:

- `lib/auth.ts`
- `lib/auth-client.ts`
- `app/api/auth/[...all]/route.ts`
- `db/schema.ts`

You do not need to create a separate auth server.

Generate two separate secrets from the **repository root**:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run this command twice: use **one** value for `BETTER_AUTH_SECRET`, and another for `PROCESSOR_SERVICE_TOKEN`.

In **`rowvitra/.env.local`** set:

```dotenv
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=paste_first_random_secret_here
PROCESSOR_SERVICE_TOKEN=paste_second_random_secret_here
```

Email/password registration can be used without Google credentials. The authentication UI includes a Google button, but Google login will only work after you configure OAuth in section 7.

**Auth scope:** The sign-in and sign-up pages support email/password, with optional Google OAuth. Password recovery, reset-by-email and verification email are not implemented. Users who lose an email/password credential cannot self-recover it through Rowvitra. Account settings still allow changing a known password after signing in.

## 5. Configure Cloudinary (required for saved CSV datasets)

1. Create or open a Cloudinary account.
2. In the Cloudinary Console, copy the **Cloud name**, **API key**, and **API secret**.
3. Add these only to the **Next.js** `.env.local`:

```dotenv
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

The implementation uses `lib/storage.ts` to upload files server-side with `resource_type: 'raw'` and `type: 'authenticated'`. Original and edited CSV versions are separate Cloudinary assets. Cloudinary credentials are **not** needed in `services/processor/.env` for this project.

A signed/authenticated raw-file configuration may require account-specific delivery settings. Test a small CSV through the real dashboard before uploading important data. Do **not** change the asset delivery type to public merely to bypass an access error.

## 6. Configure Gemini (important)

Create a Gemini API key at **https://aistudio.google.com/apikey**.

The actual AI requests run from Python, **not** from the Next.js browser or Next.js server. Add the key in **`rowvitra/services/processor/.env`** and later to the **processor Vercel project**:

```dotenv
GEMINI_API_KEY=your_real_gemini_api_key
GEMINI_MODEL=gemini-flash-lite-latest
```

The main/root `.env.example` mentions Gemini for reference, but putting the key only in `.env.local` **does not configure the Python service**. Never prefix the Gemini key with `NEXT_PUBLIC_`.

- With a valid key and model access, the authenticated workspace can request Gemini-authored repair plans and chart suggestions.
- Without a valid key, the Python engine returns appropriately labeled rule-based fallback suggestions.
- **`/demo` intentionally uses rules-based suggestions**, even if Gemini is configured. To check real Gemini behavior, sign in, upload a dataset, and use the saved dataset's AI Repair flow.

## 7. Optional: Google sign-in

### Google OAuth

1. Open Google Cloud Console and create/configure a project and OAuth consent screen.
2. Create an **OAuth client ID → Web application**.
3. Set authorized JavaScript origin to `http://localhost:3000`.
4. Set authorized redirect URI to **`http://localhost:3000/api/auth/callback/google`**.
5. Add the issued values to the **web app** `.env.local`:

```dotenv
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

For production, add the **exact** public web URL and redirect URI `https://YOUR-WEB-DOMAIN/api/auth/callback/google`. Set production `BETTER_AUTH_URL` to that same web origin. Google OAuth does not use the Python processor's URL.

## 8. Start the Python processor locally

Open a terminal and enter **`rowvitra/services/processor/`**.

**Windows PowerShell:**

```powershell
cd services/processor
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell prevents activating virtual environments, you can invoke `.\.venv\Scripts\python.exe -m pip ...` and `.\.venv\Scripts\python.exe -m uvicorn ...` directly instead. Do not disable system-wide protections unnecessarily.

**macOS/Linux:**

```bash
cd services/processor
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
```

Edit **`services/processor/.env`**:

```dotenv
PROCESSOR_SERVICE_TOKEN=paste_the_same_second_secret_used_by_nextjs
GEMINI_API_KEY=your_real_gemini_api_key
GEMINI_MODEL=gemini-flash-lite-latest
```

Start the backend **from `services/processor/`**:

```bash
python -m uvicorn app:app --reload --port 8000 --env-file .env
```

Test the public health endpoint:

- Browser: `http://localhost:8000/health`
- Expected JSON: `{"status":"ok","service":"rowvitra-processor","version":"1.0.0"}`
- Internal routes such as `POST /v1/profile` require the `X-Processor-Token` header. An unauthorized request should fail with HTTP **401**.

Leave this terminal running.

## 9. Start the Next.js web app locally

Open a **second** terminal at the repository root (`rowvitra/`). In the root **`.env.local`**, check that these minimum values are filled:

```dotenv
DATABASE_URL=postgresql://your_actual_neon_connection_url
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=first_random_secret

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret

PROCESSOR_API_URL=http://localhost:8000
PROCESSOR_SERVICE_TOKEN=the_same_second_random_secret_as_python

ENABLE_PUBLIC_DEMO=true

# Optional web-only integrations
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Reference only: set the actual key in services/processor/.env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-flash-lite-latest
```

Then run:

```bash
npm run dev
```

Open **`http://localhost:3000`**. Key routes:

| Page | URL |
|---|---|
| Landing | `/` |
| Registration | `/sign-up` |
| Sign in | `/sign-in` |
| Dashboard | `/dashboard` (requires sign-in) |
| Account settings | `/settings` (requires sign-in) |
| Dataset workspace | `/workspace/[datasetId]` (requires ownership) |
| Local sample demo | `/demo` (`ENABLE_PUBLIC_DEMO=true` only) |

The public demo is not persisted to your account and uses rules-only suggestions. **Set `ENABLE_PUBLIC_DEMO=false` in production** unless you implement abuse protection.

## 10. Verify the project before deploying

### Automated checks

Run frontend commands **from the repository root**:

```bash
npm run typecheck
npm run lint
npm run build
```

Run Python tests **from `services/processor/`** after the venv is activated:

```bash
python -m pip install pytest httpx
python -m pytest -q tests
```

The original project test run passed **32 Python tests**; repeat on your computer. The web build, typecheck, and browser E2E tests were not executed in the original authoring environment due to unavailable npm registry access. Do not skip them.

For browser tests, from the **repo root**:

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright configuration starts the Next.js dev server automatically unless `PLAYWRIGHT_BASE_URL` is set. For the demo test, keep the Python processor running and set `ENABLE_PUBLIC_DEMO=true` in the **shell running Playwright**; the test is skipped otherwise. Using only `.env.local` may not set this variable in the Playwright test runner.

**Windows:** `$env:ENABLE_PUBLIC_DEMO='true'; npm run test:e2e`  
**macOS/Linux:** `ENABLE_PUBLIC_DEMO=true npm run test:e2e`

### Manual end-to-end acceptance test

1. Open the landing page; inspect desktop and mobile layouts.
2. Create a user account, sign out, and sign in again.
3. Upload **`public/examples/messy-sales.csv`** with a goal such as *monthly revenue by region*.
4. Confirm identifier values (including leading zeros) remain strings and are protected from accidental numerical conversion.
5. Verify the profile finds relevant issues (duplicates, inconsistent region categories, and missing/invalid values).
6. Ask for a repair plan. If Gemini is enabled, confirm an actual AI result is labeled as such; otherwise verify the rules fallback is clearly labeled.
7. Preview safe repairs; inspect changed cells and before/after metrics, then approve the valid changes.
8. Edit a cell in Data Editor, inspect the new dataset version, and restore an earlier version.
9. In Visual Lab, choose chart type/axes/aggregation, filter results, click a point, inspect source rows, and save a chart.
10. Add a data rule and confirm that repairs cannot silently worsen its violations.
11. Download processed CSV, Python script, and audit JSON. Test that the script reproduces the approved CSV.
12. Sign in as a **different user** and verify that the first user's dataset ID cannot be accessed.
13. Test invalid files, oversized files, malformed repair operations, expired sessions, stale previews, and unauthorized processor requests.

**Important:** There is no verified claim that these live integrations have all passed already; complete this checklist using your own service credentials.

## 11. Deploy to Vercel — processor first

Push the `rowvitra/` project to GitHub, including the generated `package-lock.json`. Ensure `.env.local` and `services/processor/.env` are **not** committed.

### Vercel project A: `rowvitra-processor`

1. In Vercel, select **Add New → Project**, and import the Git repository.
2. Set **Root Directory** to `services/processor`.
3. Vercel can recognize the FastAPI `app` exported from `app.py`; keep the default FastAPI/Python configuration if detected.
4. Add **server-only** environment variables:

   ```dotenv
   PROCESSOR_SERVICE_TOKEN=the_exact_secret_used_in_web
   GEMINI_API_KEY=your_real_key
   GEMINI_MODEL=gemini-flash-lite-latest
   ```

5. Deploy, and open `https://YOUR-PROCESSOR.vercel.app/health`.
6. Verify that unauthenticated requests to `/v1/*` are rejected. The `/health` endpoint is intentionally public.

This project does **not** need `DATABASE_URL`, Better Auth, or Cloudinary credentials: the web app sends it the CSV text after authorizing access.

### Vercel project B: `rowvitra-web`

1. Import the **same** Git repository as a second Vercel project.
2. Set **Root Directory** to the repository root (`.`) and framework **Next.js**.
3. In **Settings → Environment Variables**, add:

   ```dotenv
   DATABASE_URL=your_production_neon_connection_url
   BETTER_AUTH_URL=https://YOUR-WEB.vercel.app
   BETTER_AUTH_SECRET=your_strong_auth_secret

   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_key
   CLOUDINARY_API_SECRET=your_cloudinary_secret

   PROCESSOR_API_URL=https://YOUR-PROCESSOR.vercel.app
   PROCESSOR_SERVICE_TOKEN=the_exact_processor_token

   ENABLE_PUBLIC_DEMO=false
   ```

4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only if Google OAuth is configured.
5. Run your reviewed database schema push/migration against Neon **before** the web app's first real sign-in.
6. Deploy the web app.
7. Update your Google OAuth authorized origins and callback URL for the deployed web domain.
8. Test authentication, uploading, analyzing, editing, charts, export, and inter-user data isolation on production URLs.

**Note:** The hosted processor is a separately deployed Vercel project, even though it lives in the same repository. If your web domain changes, update `BETTER_AUTH_URL` and Google OAuth callback URLs, then redeploy.

## 12. Common setup errors

| Error | Diagnosis / fix |
|---|---|
| `DATABASE_URL` missing during `db:push` | The Drizzle CLI might not read `.env.local`; export the variable in the shell as described in section 3. |
| Better Auth database/schema error | Verify Neon SSL, schema push, correct DB URL, and Better Auth/Drizzle schema alignment. |
| Google `redirect_uri_mismatch` | Use the exact `/api/auth/callback/google` URI and ensure `BETTER_AUTH_URL` matches the web origin. |
| Gemini appears unused | Put `GEMINI_API_KEY` in `services/processor/.env` (or processor Vercel vars), restart Python, and test via an **authenticated** dataset rather than `/demo`. |
| 401 from processor | Set **identical** `PROCESSOR_SERVICE_TOKEN` in both apps. Never pass it to the browser. |
| Cloudinary upload or signed download fails | Recheck Cloud name/key/secret and `raw/authenticated` asset handling. Do not make private datasets public to work around this. |
| `/demo` says disabled | Set `ENABLE_PUBLIC_DEMO=true` locally and restart Next.js. For production, leave it disabled. |
| Chart not rendering | Confirm chart axes, actual numeric field/aggregation, and successful `/v1/chart` response. |
| npm dependency or type errors | Run `npm install`, `npm run typecheck`, and `npm run build` on an internet-connected machine; resolve package/type compatibility before deployment. |
| Vercel Python fails to deploy | Check Root Directory `services/processor`, recognized `app.py`, `.python-version`, dependencies, Vercel logs, and function size/duration restrictions. |
| Exported Python script differs from CSV | Treat as a failure; inspect supported operations and replay verification instead of declaring export verified. |

## 13. Security and launch notes

- Never commit `.env.local`, `.env`, `node_modules`, or `.venv`. Rotate keys if accidentally exposed.
- Keep `BETTER_AUTH_SECRET`, `PROCESSOR_SERVICE_TOKEN`, Gemini and Cloudinary credentials on the server.
- Rowvitra preserves originals and stores dataset versions; accepted edits should always be traceable.
- The web route presently handles small uploads and passes CSV text to the processor: this is **not** designed for huge files.
- A long random token protects internal FastAPI endpoints, but a public production deployment should additionally consider rate limits, request size controls, logging hygiene, and usage budgets.
- CSV exported from unknown sources can contain spreadsheet formula payloads; warn users before opening it in Excel-like applications.
- Treat the existing five seeded synthetic benchmark fixtures as smoke tests, **not** as proof of real-world AI accuracy.
- Before shipping, validate every third-party integration with your account. The updated backend suite passed 36 tests, but full Next.js and external-service integration checks were not completed in the authoring environment.

## 14. Quick checklist

- [ ] Extract ZIP and `npm install`
- [ ] Create Neon database and set `DATABASE_URL`
- [ ] Generate strong auth and processor secrets
- [ ] Run `npm run db:push` with `DATABASE_URL` loaded in shell
- [ ] Add Cloudinary credentials to root `.env.local`
- [ ] Add Gemini key and processor secret to `services/processor/.env`
- [ ] Start Python on port 8000; check `/health`
- [ ] Start Next.js on port 3000
- [ ] Verify registration and private CSV upload
- [ ] Test Gemini using a signed-in dataset (not just `/demo`)
- [ ] Run tests, typecheck, lint, production build, and browser checks
- [ ] Deploy processor to Vercel; test `/health` and unauthorized 401
- [ ] Deploy web app to Vercel with correct environment variables
- [ ] Complete the production upload → repair → visualize → export acceptance test

---

**Code reference:** `rowvitra/README.md`, `rowvitra/docs/ARCHITECTURE.md`, `rowvitra/docs/TEST_REPORT.md` in the delivered ZIP.  
**Official deployment references:** https://vercel.com/docs/frameworks/backend/fastapi ; https://vercel.com/docs/monorepos ; https://better-auth.com/docs/authentication/google ; https://cloudinary.com/documentation/control_access_to_media

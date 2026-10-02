# LUNA TECH PORTAL - COPILOT INSTRUCTIONS

## Project target

Build a reliable internal employee portal for LUNA TECH. Employees sign in with company credentials, discover department resources, search and save favorites, and open approved web apps. Administrators manage users, departments, and portal resources. Supabase is the persistent data store; the API is the authority for authentication and access control.

This repository has working app and API flows, but it is not yet verified as production-ready. Treat the status below as a source-code assessment, not proof of a deployed or fully tested system.

## Current implementation

- `LUNA-HOME` is an Expo SDK 57 / React Native / TypeScript app with login, home, search, favorites, profile, department workspace, embedded web-app detail, and admin console screens.
- `LUNA-API` is a FastAPI service backed by Supabase. It implements login/JWT authentication, a role-filtered dashboard, and admin endpoints for users, departments, and resources.
- User passwords are hashed by the API. The app stores the access token in SecureStore; favorites and custom-module state are stored in AsyncStorage.
- The admin user flow calls the API. Admin resource mutations also call the API, but the UI mirrors those records into local custom-module state. Department workspace additions are currently local-only.
- `start-luna.ps1` starts the API on port 8000 and Expo on port 19006, and detects the active default-route LAN IPv4 for the frontend API URL.
- The backend contract test currently checks seed-data setup only. It calls the configured Supabase client, so inspect its target database before running it; do not point it at production for tests.

## Open work and known gaps

Use these as verified follow-up areas, not permission for unrelated rewrites. Confirm product requirements and deployment configuration before changing behavior.

- Replace or explicitly gate the API's `example.com` seed resource URLs before using seeded data as live company content.
- Make backend resources the single source of truth in the admin and department flows. Remove duplicate local mirrors, persist department additions through the API, and refresh views after mutations.
- Keep internal links in-app where supported. The web-app detail screen uses WebView, while department workspace links currently open with the system browser.
- Complete or remove placeholder account actions: forgot-password and profile update currently show informational alerts rather than performing those workflows.
- Correct and test favorites/search behavior against the full accessible resource set; favorites currently derive from only a small dashboard subset, and search matching is title-only.
- Harden deployment configuration before release: `main.py` has a fallback JWT secret and permissive wildcard CORS. Require a strong environment-provided secret, configure allowed origins, and never commit or expose credentials from `.env`.
- Replace the machine-specific startup address with configurable setup, and document the required Supabase and API environment variables without publishing their values.
- Expand automated coverage for authentication, role checks, admin CRUD, data-contract mapping, and frontend flows. Keep tests isolated from live Supabase data.
- Verify database schema/migrations and deployment behavior against a non-production Supabase project; the checked-in schema-fix SQL is a manual alignment script, not a migration workflow.

## Required source of truth

Before changing Expo or React Native app code, consult the exact versioned docs for the installed SDK:

- https://docs.expo.dev/versions/v57.0.0/

Do not assume behavior from a different Expo or React Native version. Check installed dependencies in `LUNA-HOME/package.json` before adding or upgrading packages.

## Environment and API rules

- The frontend API base URL must come from `EXPO_PUBLIC_API_BASE_URL`.
- Do not hardcode localhost, loopback, or machine-specific addresses in frontend code. Physical-device testing requires a backend address reachable from that device.
- Keep API configuration out of source defaults; do not place credentials or secrets in Expo public variables.
- Preserve the existing ports and startup flow unless the task requires a deliberate, documented change.

## Business and access rules

- Employee email addresses must use the `@luna.co.in` company domain. Preserve backend validation when changing user flows.
- Do not add attendance, approvals, or other personal HRM shortcuts as active portal features unless explicitly approved as real business features.
- Keep roles consistent: `Admin`, `Manager`, `Supervisor`, and `User`.
- Backend authorization is authoritative. Frontend role filtering is for presentation and must never replace API checks.
- Do not silently truncate accessible departments or resources. Keep dashboard visibility consistent with backend access rules and the agreed business model.

## Implementation guardrails

- Keep frontend and backend request/response models aligned. Update the API models, endpoint, caller, and focused tests together when changing a contract.
- Prefer live backend data over local defaults. Use local persistence only for user-specific state that is intentionally device-local.
- Use the existing portal API service for network requests and keep screens from creating parallel API implementations.
- Preserve navigation and LUNA branding unless the requested behavior requires a change.
- Fix the cause of a defect with a small, scoped change; do not mask API or persistence failures with mock data.
- Never use production credentials or production data for local tests. Do not log tokens, passwords, or secret environment values.

## Verification

Run the smallest relevant checks and report what was and was not verified.

Frontend, from `LUNA-HOME`:

```powershell
npx --yes tsc --noEmit
```

Backend syntax, from `LUNA-API`:

```powershell
python -m py_compile main.py
```

Before running backend tests, inspect their database dependencies and configure an isolated test database. Do not run tests that call `ensure_seed_data()` against a production Supabase project.

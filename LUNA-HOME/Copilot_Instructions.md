# LUNA TECH PORTAL - COPILOT INSTRUCTIONS

## Project target

Build a reliable internal employee portal for LUNA TECH. Employees sign in with company credentials, discover department resources, search and save favorites, and open approved web apps. Administrators manage users, departments, and portal resources. Supabase is the persistent data store; the API is the authority for authentication and access control.

This repository has working app and API flows, but it is not yet verified as production-ready. Treat the status below as a source-code assessment, not proof of a deployed or fully tested system.

## Current repo status snapshot (updated 2026-10-05)

### Completed / working in source

- The Expo app includes the main employee portal screens: login, home, search, favorites, profile, department workspace, resource detail, and admin console.
- The FastAPI backend includes JWT-based auth, password hashing, role checks, user lookup, and admin CRUD endpoints for users, departments, and resources.
- Supabase-backed persistence is integrated, with startup seeding and default department ordering in place.
- The app stores session state locally and routes users by role after login.
- Local validation in the workspace has shown the frontend TypeScript check and backend Python compilation succeed for the checked-in source.

### In progress / partially implemented

- The backend still uses permissive CORS configuration and a wildcard allowlist instead of a locked production origin policy.
- Several seeded resources and department defaults still use placeholder/example URLs, which is not acceptable for production data.
- Department workspace additions and favorites behavior remain partially local or not fully aligned to a reviewed backend source of truth.
- Password reset/profile flows exist in the API but still require a clear production decision and secure operational setup.
- The app has a basic working flow, but it has not yet reached a full staging/production release gate.

### Critical gaps before release

- Remove hard-coded or default secrets, credentials, and example business data from source.
- Require a real JWT secret from deployment secrets and eliminate unsafe development defaults.
- Replace wildcard CORS and insecure web token storage assumptions with a reviewed production design.
- Establish a real migration strategy and non-production database separation instead of relying on ad hoc scripts and live seed logic.
- Add a real test suite and CI validation for API and frontend behavior.
- Validate staging deployment, rollback, and operational readiness before any production rollout.

### Where we are now

We are at the implementation-complete / hardening phase, not the release-ready phase. The app and API are functional and aligned to the core portal use case, but the project still needs security, data, and deployment hardening before it should be treated as production-ready.

## Project status and production-readiness flow

Status is based on the checked-in source and local workspace checks, not on a production deployment. Treat a stage as complete only when its exit criteria have been demonstrated in the target environment. Record decisions and evidence in the pull request or release record; do not infer production readiness from a successful local build.

### Implemented in source

- `LUNA-HOME` is an Expo SDK 57 / React Native / TypeScript app with login, home, search, favorites, profile, department workspace, embedded web-app detail, and admin console screens.
- `LUNA-API` is a FastAPI service with password-hash login, JWT authentication, a role-filtered dashboard, and API routes for user, department, and resource administration.
- Supabase is used for persistent backend records. Startup currently seeds default records and normalizes department ordering.
- Admin user management calls the API. Admin resource management also calls the API, but resource state is mirrored locally; department workspace additions remain local-only.
- Native token storage uses SecureStore. Web token storage uses AsyncStorage because SecureStore's native methods are unavailable on web; this is a production security decision that must be resolved before enabling web sign-in for real users.
- Local development uses Expo and Uvicorn. `start-luna.ps1` detects a LAN IP, but includes a machine-specific path and force-stops processes on the app ports; it is a local helper, not a production deployment mechanism.

### Verified locally in this workspace

- Expo SDK dependency compatibility check and TypeScript no-emit check pass.
- Backend Python source compiles.
- The local API docs and Expo web page returned HTTP 200, and the login page rendered. A prior local session also recorded successful login/dashboard requests.
- The only checked-in backend test is a seed-data contract test that calls the configured Supabase database. No frontend test suite, CI workflow, production deployment manifest, or repeatable migration framework was found in the tracked project tree.
- The last `npm audit --omit=dev` reported 23 advisories (16 high, 7 moderate). Its forced fix proposed downgrading Expo to SDK 44, so that breaking change was not applied. Re-run the audit against the current lockfile before release.
- These checks do not establish security, full feature correctness, mobile-device compatibility, release-build correctness, availability, or production readiness.

### Stage 0 — Contain credentials and remove unsafe defaults

Do this before connecting a release build to any real user data.

- Rotate Supabase credentials and bootstrap/admin passwords that were placed in source, shared outside approved secret storage, or used for local experimentation. Assume exposed credentials are compromised; never copy their values into tickets, logs, docs, or Expo public variables.
- Remove hard-coded Supabase connection details and fixed bootstrap identity/password from `LUNA-API/create_admin.py`. Make bootstrap an explicit, one-time operator action that reads secrets securely, is safe to rerun or clearly rejects duplicates, and does not print secrets.
- Remove default user passwords from frontend request construction. Require an administrator to set a compliant initial credential or implement a verified invitation/reset flow.
- Make `JWT_SECRET_KEY` mandatory, sufficiently random, and loaded from deployment secrets; remove the development fallback. Define token expiry and the response to expiry/revocation.
- Replace wildcard CORS with an explicit allowlist for the intended web origins. Keep native-app/API access working without treating CORS as authorization.
- Keep `.env` files local and ignored. Add only a placeholder `.env.example` with variable names and safe descriptions, never real values. Verify no secrets are tracked or logged.
- Confirm the backend uses the intended least-privilege Supabase key and that database RLS/service-role behavior matches the chosen authorization design.

**Exit gate:** rotated credentials are active; no source-controlled secrets/default credentials remain; authentication, CORS, and database privilege decisions are reviewed; negative auth tests pass.

### Stage 1 — Lock product and data decisions

- Approve the exact internal resources, URLs, departments, role visibility, and owner for each resource. Replace or explicitly disable all `example.com` seed URLs; do not seed placeholders into a live company database.
- Decide whether favorites are per-user and cross-device or intentionally device-local. The current favorites response uses only a small dashboard subset.
- Decide whether department workspace additions are supported production data. If so, persist them via authorized API routes rather than local-only state.
- Decide whether Forgot Password and profile update are supported release features. Implement the approved flows securely or remove/disable the controls; they currently show informational alerts.
- Approve link-opening behavior for internal resources, especially external browser versus in-app WebView, and define an allowlist/policy for destinations.
- Confirm the launch platforms (web, Android, iOS), supported devices, branding/app identifiers, employee onboarding process, and operational owner.

**Exit gate:** product owner signs off on scope, seeded content, role/access matrix, account lifecycle, and target platforms.

### Stage 2 — Establish safe database lifecycle and source of truth

- Create separate non-production and production Supabase projects. Never run contract tests or seed scripts against production.
- Replace the manual `supabase_schema_fix.sql` alignment script with reviewed, ordered, repeatable migrations and a documented production migration procedure. Back up production before schema changes.
- Move seed/normalization work out of unconditional API startup. Make production migrations and approved seed data explicit, repeatable deployment steps with a dry-run/review path; normal API restarts must not unexpectedly alter business data.
- Review schema constraints, unique keys, foreign keys, indexes, password-hash storage, RLS, backup/restore, and least-privilege access.
- Make backend records the source of truth for admin resources and departments. Remove duplicate local mirrors or clearly separate draft-only UI state; refresh screens from API responses after mutations.
- Define and test data mapping for every API resource type and department. Ensure search and favorites operate over the full set the signed-in user is authorized to see, without silent truncation.

**Exit gate:** migrations apply cleanly to a fresh staging database and an upgrade copy; seed data contains approved values only; CRUD and visibility checks pass against staging.

### Stage 3 — Close application and API behavior gaps

- Enforce authorization in every protected API route; frontend role filtering is presentation only. Verify role hierarchy, inactive users, self-escalation, cross-department access, and object-level access.
- Add the approved profile/password lifecycle or remove placeholder actions. Handle logout, token expiry, invalidation, and account deactivation consistently.
- Decide on a secure web token mechanism before production web login. Do not treat localStorage/AsyncStorage as equivalent to native secure storage; prefer a reviewed secure-cookie/BFF design if web is in scope.
- Complete persistence for approved department/resource flows and favorites; remove defaults such as the client-side fallback user password.
- Validate and normalize input at the API boundary, including URLs, roles, department IDs, resource types, pagination/limits, and user fields. Return stable, documented error shapes and avoid leaking internals.
- Replace the development launcher assumptions for deployed environments. Keep the LAN launcher clearly local-only; do not use its process-killing behavior in shared or production environments.

**Exit gate:** agreed user journeys work end-to-end on every launch platform; API contracts and access rules are documented; no production feature depends on placeholder content or local-only state unless explicitly approved.

### Stage 4 — Tests, quality gates, and dependency health

- Replace `LUNA-API/test_backend_contract.py`'s live `ensure_seed_data()` dependency with isolated unit/integration tests using mocks or a dedicated disposable staging database.
- Add API tests for login, hashing, token expiry, role/access boundaries, user CRUD, department/resource CRUD, validation, and schema/data mapping.
- Add frontend tests for login/logout/storage, loading/error/empty states, search, favorites, role presentation, and admin/department mutations. Include web and native-specific storage behavior.
- Add repeatable CI for Python lint/type/syntax/tests, TypeScript, frontend tests, Expo SDK compatibility, dependency auditing, and build validation. CI must not receive production secrets.
- Pin or constrain backend dependencies and use a reproducible lock/constraints strategy. Review `npm audit` and Python advisories; update through compatible releases and test the lockfile. Do not use forced major downgrades as an audit fix.
- Run Expo web and intended Android/iOS release builds, not only Metro development mode. Test supported physical devices and network conditions.

**Exit gate:** CI is green from a clean checkout; tests use no production data; vulnerabilities are remediated or have a documented, time-bound risk acceptance; all target-platform release builds succeed.

### Stage 5 — Staging deployment and operational readiness

- Choose and document the production API host, DNS, HTTPS/TLS, secrets manager, runtime/start command, scaling/health checks, logs, alerting, and deployment owner. Run Uvicorn without `--reload` in production.
- Configure staging-only Supabase credentials and `EXPO_PUBLIC_API_BASE_URL` at build/deploy time. The public Expo variable may contain only the API URL, never a credential.
- Add liveness/readiness checks that distinguish process health from database dependency health. Define timeouts, request limits, rate limits, and safe error logging.
- Configure production CORS, trusted proxy behavior, TLS, backups/restore tests, migration ordering, and rollback/forward-fix procedures.
- For mobile releases, configure EAS/build signing, bundle/package identifiers, update channel/runtime policy, privacy disclosures, and store credentials. For web, configure static hosting, cache policy, security headers, and permitted origins.
- Verify startup, login, role visibility, CRUD, logout/expiry, links, and failure recovery in staging using test accounts and non-production data. Confirm no secrets appear in built JS, source maps, logs, or client requests.

**Exit gate:** staging deployment and recovery runbook are exercised by someone other than the implementer; staging smoke tests pass on all launch platforms.

### Stage 6 — Controlled production release and operations

- Obtain product, security, database, and operations sign-off. Confirm backups and rollback/forward-fix plan immediately before release.
- Apply reviewed migrations once, deploy the API, verify health, then publish the frontend/mobile release configured for the production API.
- Use a limited pilot/cohort first. Monitor authentication failures, API errors/latency, database health, and user-reported issues; have a named owner and escalation route.
- Expand rollout only after the agreed observation window and success thresholds are met. Record deployed versions, migration IDs, approvals, and rollback decisions.
- Maintain incident response, credential rotation, dependency patching, backup restore drills, and a regular review of access/employee offboarding.

**Production go/no-go:** all prior exit gates are met; no known default credentials or placeholder URLs remain; security and product approvals are recorded; tested rollback/restore exists; monitoring and ownership are active.

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
npx tsc --noEmit
npx expo install --check
```

Backend syntax, from `LUNA-API` using the configured project Python environment:

```powershell
python -m py_compile main.py
```

Before running backend tests, inspect their database dependencies and configure an isolated test database. Do not run tests that call `ensure_seed_data()` against production Supabase. Local checks are not release checks: run the test/build suite and smoke tests against staging before requesting production approval.

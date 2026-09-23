# LUNA TECH PORTAL - COPILOT INSTRUCTIONS

## 1. Project context

This workspace contains a production-minded internal portal for LUNA TECH with:
- Frontend: Expo + React Native + TypeScript in LUNA-HOME
- Backend: FastAPI in LUNA-API
- Database: Supabase-backed user and portal data
- Runtime startup: start-luna.ps1 at the workspace root

The app is not a mock prototype. Future work must respect the live backend contract, role-based access rules, and the production portal workflow already implemented.

## 2. Required source of truth

Before changing app code, read the exact versioned Expo docs for the installed SDK:
- https://docs.expo.dev/versions/v57.0.0/

Do not assume React Native behavior from newer or older Expo versions.

## 3. Environment and API rules

- Use EXPO_PUBLIC_API_BASE_URL only.
- Do not hardcode localhost, 127.0.0.1, or machine-local addresses in frontend code.
- For physical-device testing, use the same LAN/hotspot IP as the backend server.
- The backend must run on a reachable IP and the app must use that address in the environment config.
- Keep startup and network configuration stable; do not reintroduce stale loopback values.

## 4. Business rules the app must follow

- Employee email format must be LUNA-domain based, such as MIS1@LUNA.CO.IN or DISPATCH@LUNA.CO.IN.
- User creation and update flows must preserve the company email convention and never fall back to mock local addresses.
- Quick-access / personal HRM modules such as attendance and approvals must not be treated as active app features unless explicitly added as a real business feature.
- Web apps should open directly from the home dashboard and stay inside the app using embedded web content when possible.
- Do not force external browser redirects for internal app links.
- Department and module visibility must reflect real, role-aware access rules and not be silently truncated.

## 5. Data and backend rules

- Keep frontend and backend schemas aligned.
- When changing a data contract, update the API model and frontend caller together.
- Do not revert to mock-only state when live backend data exists.
- Respect backend authentication and authorization; never rely only on frontend hiding.
- Keep admin actions backend-validated and secure.

## 6. Architecture guardrails

- Frontend state should remain consistent with live backend responses.
- Use the existing portal API layer for dashboard and admin actions.
- Keep the navigation structure stable and avoid unnecessary route churn.
- Preserve production app branding and enterprise UX style.
- Fix root causes rather than layering workarounds.

## 7. Verification before completion

Any change must be checked with the relevant validation commands before claiming success.

For frontend:
- npx --yes tsc --noEmit

For backend:
- python -m py_compile main.py

Run the smallest relevant validation that proves the changed behavior remains correct.

## 8. Future coding expectations

When working in this repo:
- prefer backend-backed data over local-only or stale defaults
- keep the role model consistent: Admin, Manager, Supervisor, User
- maintain department and module sync with Supabase-backed data
- preserve the current working startup flow and avoid port churn
- fix production issues with a small, root-cause change instead of broad speculative edits

## 9. Critical “do not” list

- Do not hardcode localhost or 127.0.0.1 in app URLs
- Do not reintroduce personal HRM quick-access items as default portal content
- Do not leave stale LUNA or local-domain email patterns in user records
- Do not bypass backend validation with client-only logic
- Do not treat admin-only screens as complete without backend enforcement
- Do not add production logic that conflicts with the app’s existing network and startup flow

This file is the active instructions source for future Copilot work on the LUNA portal.

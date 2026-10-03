# Home Laptop Handover

## TODAY'S UPDATES

- **Dynamic portal UI and container visibility:** The Home dashboard loads resources and departments from the backend, filters individual resources according to the signed-in role, and keeps the Web Apps and Departments section containers visible even when their contents are empty.
- **Manager/Admin RBAC:** User and Supervisor visibility follows the resource's `required_role` hierarchy. Managers can view all portal resources, including Admin-required resources, but do not get Admin Console access or resource-management controls. Admins can view all resources and are the only role shown Add, Edit, and Delete controls.
- **Department and search access:** Department workspaces filter custom resources by role. Search results apply role visibility and open department workspaces, web apps, and resource links when selected.
- **Backend authorization:** Protected resource, department, and user POST/PUT/DELETE endpoints require an active Admin account and return 403 to other roles. Authenticated GET endpoints return role-appropriate resources; portal dashboard departments remain visible to all signed-in users.
- **Search interaction:** Search results are clickable. Web apps open using the same in-app detail view as Home (custom app links open directly), departments navigate to their workspace, and other resources open their destination URL.
- **Forgot Password:** The login screen has an email-code reset modal. The backend emails a short-lived, rate-limited verification code, stores only its keyed hash, limits verification attempts, and updates the password hash after a valid code is supplied. This requires the `password_reset_tokens` table from `LUNA-API/supabase_schema_fix.sql` and SMTP settings below.
- **Credential handling:** Removed embedded Supabase credentials and the default JWT secret from backend source. The API now requires `SUPABASE_URL`, `SUPABASE_KEY`, and a strong `JWT_SECRET_KEY` in its local environment. The Admin bootstrap script also reads Supabase settings from the environment and prompts for an initial password.
- **Admin-created user passwords:** Removed the hardcoded initial password; the Admin Console requires an initial password of at least eight characters when creating a user.

## EXACT .ENV FILES

**Do not put real API keys, service-role keys, JWT secrets, SMTP passwords, or other credentials in this handover file or commit them to Git.** The Supabase key values were included in a chat request; rotate/revoke any real key that was exposed, especially a service-role/secret key. Use a local, ignored `.env` file on each machine and obtain replacement credentials through a trusted channel.

Backend file: `LUNA-API/.env`. Replace the placeholders locally. `SUPABASE_SERVICE_KEY` is included only as a local variable if another trusted tool needs it; this API currently uses `SUPABASE_KEY`.

```dotenv
SUPABASE_URL=https://xvlkjsuquhriiqnpujjt.supabase.co
SUPABASE_KEY=<YOUR_ROTATED_SUPABASE_API_KEY>
SUPABASE_SERVICE_KEY=<YOUR_ROTATED_SUPABASE_SERVICE_KEY>
JWT_SECRET_KEY=<GENERATE_A_RANDOM_SECRET_OF_AT_LEAST_32_BYTES>
SMTP_HOST=<YOUR_SMTP_HOST>
SMTP_PORT=587
SMTP_USERNAME=<YOUR_SMTP_USERNAME>
SMTP_PASSWORD=<YOUR_SMTP_PASSWORD>
SMTP_FROM_EMAIL=<YOUR_VERIFIED_SENDER_EMAIL>
```

Generate a JWT secret locally in PowerShell without displaying or saving it to this file:

```powershell
$bytes = New-Object byte[] 32
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$env:JWT_SECRET_KEY = [Convert]::ToBase64String($bytes)
$rng.Dispose()
```

The command above sets the secret only for that PowerShell session. For a persistent local setup, put a newly generated value in the ignored `LUNA-API/.env` file instead.

Frontend file: `LUNA-HOME/.env`. **Change `<HOME_WIFI_IP>` to the laptop's current Wi-Fi/hotspot IPv4 address** (find it with `ipconfig`).

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://<HOME_WIFI_IP>:8000
```

## RUN COMMANDS

Open two PowerShell terminals from the repository root. Start the backend in the first terminal:

```powershell
Set-Location .\LUNA-API
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Start the frontend in the second terminal:

```powershell
Set-Location .\LUNA-HOME
npx expo start --clear
```

If `python` is not the intended Python installation on the home laptop, use that environment's Python executable for `python -m uvicorn`. The backend must have its local `.env` configured before startup.

Do **not** turn off Windows Firewall for Public Networks. If devices on a mobile hotspot need to reach the laptop, allow inbound TCP ports 8000 (API) and the Expo port shown in the Expo terminal only as narrowly as needed; prefer a trusted Private network profile. Keep the API and development server off untrusted networks.

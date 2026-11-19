# Divine Academy Portal — Account Provisioning & Student Admission-Number Auth Deployment Guide

This guide covers deploying the secure server-side account provisioning workflow and **Student Admission Number + Password** login for **Students**, **Teachers**, and **Parents** without modifying `supabase/schema.sql` or weakening any of the existing 27 tables or 74 RLS policies.

---

## 1. Additive SQL Migrations (Review & Execute Manually in Supabase SQL Editor)

Review and run these non-destructive, idempotent SQL migration files in **Supabase Dashboard -> SQL Editor**:

1. `supabase/migrations/20260501_account_provisioning.sql` (Optional / recommended for status metadata & uniqueness guards):
   - Adds additive metadata columns on `public.user_profiles` (`account_status`, `must_change_password`, `invited_at`, `activated_at`).
   - Adds uniqueness guards (`uq_user_profiles_role_reference`, `uq_user_profiles_email_lower`, and `uq_students_admission_no_normalized` on `public.students (lower(trim(admission_no)))`).
   - Installs least-privilege RPCs (`get_admin_account_statuses`, `get_my_account_security_state`, `complete_my_password_setup`).
2. `supabase/migrations/20260502_student_login_rate_limits.sql` (Recommended for persistent cross-instance atomic rate limiting):
   - Creates `public.student_login_rate_limits` (RLS enabled, `service_role`-only, stores SHA-256 hashed bucket keys only — zero plaintext IPs or admission numbers).
   - Installs atomic row-locked RPCs (`consume_student_login_attempt`, `clear_student_login_rate_limit`, `release_student_login_attempt`, `prune_student_login_rate_limits`) granted exclusively to `service_role`.
   - `student-auth-login` automatically uses these atomic PostgreSQL RPCs once applied, and safely falls back to a bounded in-memory sliding-window limiter beforehand.

> Neither migration drops, alters, or weakens any of the 27 existing portal tables, 74 existing RLS policies, student records, or administrator accounts.

---

## 2. Deploy Both Supabase Edge Functions

Two server-side Edge Functions power account creation and student Admission Number login:

1. **`admin-account-provisioning`** (`supabase/functions/admin-account-provisioning`) — Administrator-only creation of student, teacher, and parent login accounts, password assignment, account status checks, and disable/reactivate controls.
2. **`student-auth-login`** (`supabase/functions/student-auth-login`) — Required companion function for **Student Admission Number + Password** sign-in (with server-side rate limiting and anti-enumeration responses).

### Option A: Deploy via Supabase CLI

Run from the project root:

```bash
# 1. Authenticate and link your Supabase project
npx supabase login
npx supabase link --project-ref <YOUR_PROJECT_REF>

# 2. Deploy the admin-only account provisioning function
npx supabase functions deploy admin-account-provisioning

# 3. Deploy the student Admission Number sign-in function
#    (--no-verify-jwt is REQUIRED because unauthenticated students call this endpoint to log in)
npx supabase functions deploy student-auth-login --no-verify-jwt
```

> **Note on newer Supabase projects using ECC (ES256) JWT signing keys:** `admin-account-provisioning` independently verifies every caller's Supabase JWT on the server via `adminClient.auth.getUser(jwt)` AND verifies `role = 'admin' AND is_active = true` in `public.user_profiles`. If your project's legacy Edge Gateway returns `401 Invalid JWT` before the function runs, deploy `admin-account-provisioning` with `--no-verify-jwt` (or toggle off legacy gateway JWT verification in the Dashboard) — full server-side JWT and administrator-role verification remains strictly enforced inside the function.

### Option B: Deploy via Supabase Dashboard (Web Editor)

Both Edge Functions are self-contained single-file `index.ts` modules with zero local shared imports:

1. Open **Supabase Dashboard -> Edge Functions -> Deploy a new function -> Via Editor**.
2. Create function **`admin-account-provisioning`**:
   - Paste `supabase/functions/admin-account-provisioning/index.ts` directly into `index.ts`.
   - Click **Deploy function**.
3. Create function **`student-auth-login`** (required for Student Admission Number + Password login):
   - Paste `supabase/functions/student-auth-login/index.ts` directly into `index.ts`.
   - Under function **Details / Settings**, disable **Verify JWT with legacy secret / Enforce JWT Verification** (required because unauthenticated students call it before signing in).
   - Click **Deploy function**.

### Edge Function Secrets & Environment Configuration
- **Auto-injected by Supabase (no manual setup required)**: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or `SUPABASE_PUBLISHABLE_KEYS`), and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEYS`) are injected automatically into deployed Edge Functions.
- **Never** add `SUPABASE_SERVICE_ROLE_KEY` or any secret key to `.env`, `.env.local`, Vite, or Vercel frontend environment variables.
- **Optional recommended production secrets** (configure under **Supabase Dashboard -> Edge Functions -> Secrets** or via CLI):

```bash
# Comma-separated browser origins allowed to call the Edge Functions (include local dev / preview URLs if testing)
npx supabase secrets set ALLOWED_ORIGIN="https://your-school-portal-domain.com"

# Comma-separated redirect origins allowed for Teacher/Parent setup invitation links
npx supabase secrets set ALLOWED_REDIRECT_ORIGINS="https://your-school-portal-domain.com"
```

---

## 3. Supabase Authentication Dashboard Configuration

In **Supabase Dashboard -> Authentication**:

1. **URL Configuration**:
   - **Site URL**: Set to your live portal origin (e.g., `https://your-school-portal-domain.com` or `http://localhost:3000` for local testing).
   - **Redirect URLs**: Add your production domain, preview domain (if used), and local dev origin (`http://localhost:3000`).
2. **Disable Public Self-Signup (Required for School Portal Security)**:
   - Under **Authentication -> Providers -> Email**, keep public self-registration disabled so students, staff, and parents cannot self-register. Admin-initiated provisioning via `admin-account-provisioning` continues to operate normally.
3. **Email Provider / SMTP (for Teacher/Parent Setup Invites)**:
   - Keep **Email** provider enabled. If using setup invitation emails for teachers or parents in production, configure a verified custom SMTP provider under **Project Settings -> Authentication -> SMTP Settings**.

---

## 4. Login Identifier & Authentication Architecture

| Portal Role | Login Identifier | Password Management |
| :--- | :--- | :--- |
| **Student** | **Admission Number** (e.g. `STD/2026/0001`) + Password | Assigned by an authenticated Administrator during registration or via **Manage Access & Password**. Personal email is **not** required for student login. |
| **Teacher / Staff** | **Official Email Address** + Password | Assigned by an authenticated Administrator (initial password or setup invite). Signed-in teachers can also update their own password anytime via **Teacher Portal -> Account Security**. |
| **Parent / Guardian** | **Registered Email Address** + Password | Assigned by an authenticated Administrator (initial password or setup invite). Strictly scoped to explicitly linked children in `public.parent_students`. |
| **Administrator** | **Administrator Email Address** + Password | Managed by existing Supabase Auth admin identity (`public.user_profiles.role = 'admin'`). Signed-in administrators can rotate their password via **Admin Portal -> System Settings**. |

### How Student Admission Number Sign-In Works Safely
1. When an administrator provisions a student account, `admin-account-provisioning` creates the student's Supabase Auth identity using a deterministic non-deliverable internal identifier (`std.<recordId>@students.divineacademy.internal`) stored **only** in `auth.users` and `public.user_profiles` — never written to `public.students.email` and never exposed in the UI.
2. When a student enters their **Admission Number + Password** in the portal login modal, the client calls the `student-auth-login` Edge Function.
3. `student-auth-login` enforces rate limits per normalized Admission Number (5 failed attempts per 15 minutes) and per client IP (20 failed attempts per 15 minutes), returning HTTP `429` with `Retry-After` if exceeded.
4. On the server (`service_role`), it resolves `admission_no -> auth_user_id -> active student user_profile -> auth.users.email`, verifies the password via Supabase Auth `signInWithPassword`, and returns **only** short-lived session tokens on success — or a uniform HTTP `401` (`"Invalid admission number or password."`) on any failure to prevent account enumeration.
5. Passwords are never stored in school directory tables or `localStorage`, never logged, and never returned in any server response.

---

## 5. Restricted, Verified Account-Support Procedure (Lost Credentials)

All public password-recovery links, "Forgot password?" buttons, and unauthenticated password-reset forms have been intentionally removed from every login screen and portal interface to prevent unauthorized reset requests or account probing.

If a user loses access to their password, follow this verified administrative procedure:

1. **Students**:
   - The student (or their verified guardian) reports the lockout to the school administrator / ICT desk in person or via verified school contact channels.
   - The administrator verifies the student's identity and Admission Number, opens **Admin Portal -> Students -> Manage Access & Password**, enters and confirms a new password, and communicates it privately to the student/guardian.
2. **Teachers & Staff**:
   - Logged-in teachers can update their own password anytime via **Teacher Portal -> Account Security**.
   - If locked out, after out-of-band identity verification (in person or via verified official contact), the administrator opens **Admin Portal -> Teachers -> Manage Access & Password**, assigns a new password with **"Require user to change password on next sign-in"** checked, and hands it off privately.
3. **Parents / Guardians**:
   - After verifying the guardian's identity against the registered phone number / ward details on file, the administrator opens **Admin Portal -> Parents -> Manage Access & Password**, assigns a new password with **"Require user to change password on next sign-in"** checked, and hands it off privately.
4. **School Administrators (Break-Glass Recovery)**:
   - Administrator accounts cannot be modified through the portal's provisioning Edge Function (privilege-escalation guard).
   - If the primary administrator loses access, the authorized Supabase project owner must verify identity out of band, update the administrator user's password directly in **Supabase Dashboard -> Authentication -> Users** (requiring owner MFA), and instruct the administrator to rotate their password immediately upon signing in via **Admin Portal -> System Settings**.

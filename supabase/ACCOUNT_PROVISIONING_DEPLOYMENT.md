# Divine Academy Portal — Account Provisioning Deployment & Configuration Guide

This guide covers deploying the secure server-side account provisioning workflow for **Students**, **Teachers**, and **Parents** without modifying any of the existing 27 tables or 74 RLS policies.

---

## 1. Optional Minimal Additive SQL Migration (Recommended)

Review and run `supabase/migrations/20260501_account_provisioning.sql` in **Supabase Dashboard -> SQL Editor**.

What it adds (non-destructive, idempotent):
- Additive columns on `public.user_profiles`: `account_status`, `must_change_password`, `invited_at`, `activated_at`.
- Uniqueness guards on `public.user_profiles`: `uq_user_profiles_role_reference` and `uq_user_profiles_email_lower`.
- Three least-privilege RPCs:
  - `public.get_admin_account_statuses()` (Admin-only authoritative status query joining `user_profiles` + `auth.users`).
  - `public.get_my_account_security_state()` (Self-service check for mandatory first-login password setup).
  - `public.complete_my_password_setup()` (Clears `must_change_password` after user sets their personal password).

---

## 2. Deploy the Supabase Edge Function

The Edge Function `supabase/functions/admin-account-provisioning/index.ts` handles all privileged Supabase Admin Auth operations strictly on the server so the service-role key is never exposed to browsers and the administrator's session is never disrupted.

Using the Supabase CLI:

```bash
# 1. Link your local repository to your Supabase project
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# 2. Deploy the Edge Function
supabase functions deploy admin-account-provisioning
```

### Automatic & Optional Edge Function Secrets

Supabase automatically injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into deployed Edge Functions. Do **not** add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`, Vite, or Vercel frontend variables.

Optional origin lockdown secrets (recommended for production):

```bash
supabase secrets set ALLOWED_ORIGIN="https://your-school-portal-domain.com"
supabase secrets set ALLOWED_REDIRECT_ORIGINS="https://your-school-portal-domain.com"
```

---

## 3. Required Supabase Authentication Dashboard Configuration

In **Supabase Dashboard -> Authentication**:

1. **URL Configuration**:
   - **Site URL**: Set to your live portal origin (e.g., `https://your-school-portal-domain.com` or `http://localhost:3000` for local testing).
   - **Redirect URLs**: Add your production domain, Vercel preview domain (if used), and local dev origin (`http://localhost:3000`).
2. **Email Provider / SMTP**:
   - Enable **Email** provider under **Authentication -> Providers -> Email**.
   - For production invitation and password reset emails beyond Supabase's built-in rate limits, configure a verified custom SMTP provider under **Project Settings -> Authentication -> SMTP Settings** (e.g., Resend, Postmark, Brevo, or Google Workspace SMTP).
3. **Email Templates**:
   - Review **Invite user** and **Reset password** templates under **Authentication -> Email Templates** so redirect links point to `{{ .SiteURL }}`.
4. **Disable Public Self-Signup (Recommended for School Portals)**:
   - Under **Authentication -> Providers -> Email**, keep public self-registration disabled if only administrators should provision accounts. Admin-initiated `inviteUserByEmail` and `admin.createUser` continue to work via the Edge Function.

---

## 4. Login Identifier Policy & Future Admission-Number Login Architecture

### Current Implemented Policy (Recommended & Active)
- Every student, teacher, and parent login account requires a **valid, unique email address** managed by Supabase Authentication (`auth.users`).
- No fake or synthetic email addresses are ever fabricated for students.
- Student records may be enrolled first without an email (`Account not created`) and provisioned later via **Create Login Account** once an approved email address is available.

### Documented Server-Side Design for Optional Admission-Number Login (If Needed Later)
If Divine Academy later decides students should type their **Admission Number** (e.g., `STD/2026/1042`) on the login form instead of an email address, follow this secure architecture rather than fabricating unverified emails:

1. **Real Deliverable Email Still Stored Server-Side**: Each provisioned student still has a verified school-managed or parent-approved email on `auth.users` so password recovery and security notifications work reliably.
2. **Dedicated Server-Side Sign-In Proxy Edge Function (`student-admission-signin`)**:
   - Accepts `{ admissionNo, password }` over HTTPS POST.
   - Applies strict IP + admission-number rate limiting to block brute-force and enumeration attacks.
   - Looks up `public.students` by normalized `admission_no` (`status = 'Active'`, `auth_user_id IS NOT NULL`) using `service_role` strictly on the server, then resolves the linked `auth.users.email` **without ever returning the email to unauthenticated callers**.
   - Calls Supabase Auth password grant server-side and returns a generic `"Invalid admission number or password."` error for both unknown admission numbers and wrong passwords (preventing account enumeration).
   - Returns the short-lived session tokens only upon successful credential verification.

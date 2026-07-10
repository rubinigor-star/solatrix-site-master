# Solatrix CRM foundation setup

This repository contains the public site, the first CRM database migration, and the `submit-lead` Edge Function. Real leads are never stored only in the visitor's browser once production is configured.

## 1. Create a Supabase project

Create a new project in the Supabase dashboard and keep it in the same region you expect to use for the CRM.

Copy these public values from **Project Settings → API**:

- Project URL
- anon/public key

Add them to the Vite production environment:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

The anon key is allowed in the browser. Never place the service-role key in a `VITE_` variable.

## 2. Apply the database migration

With the Supabase CLI linked to the project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates:

- `profiles`
- `leads`
- `lead_events`
- `reports`
- `tasks`
- private Storage bucket `lead-reports`
- Row Level Security policies

Public forms cannot read the CRM tables and do not insert directly into them.

## 3. Deploy the lead intake function

```bash
supabase functions deploy submit-lead --no-verify-jwt
```

Set server-only secrets:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set LEAD_NOTIFICATION_EMAIL=rubin.igor@gmail.com
```

The project URL is normally supplied automatically to Edge Functions as `SUPABASE_URL`.

## 4. Optional email notifications

Create a Resend account, verify a sending domain, and set:

```bash
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set 'LEAD_FROM_EMAIL=Solatrix Leads <leads@YOUR_DOMAIN>'
```

Every successful form submission will then send a lead summary to `LEAD_NOTIFICATION_EMAIL`.

## 5. Optional Google Sheets copy

Deploy a Google Apps Script web app that accepts JSON by POST and appends a row to the required spreadsheet.

Set the webhook URL and a shared secret:

```bash
supabase secrets set GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
supabase secrets set GOOGLE_SHEETS_WEBHOOK_SECRET=YOUR_RANDOM_SECRET
```

Google Sheets is an operational copy. Supabase remains the source of truth.

## 6. Create the first CRM user

Create the user in **Authentication → Users**. A profile row is created automatically with the `viewer` role.

Promote the owner account in SQL Editor:

```sql
update public.profiles
set role = 'admin', is_active = true
where id = (
  select id from auth.users where email = 'rubin.igor@gmail.com' limit 1
);
```

## 7. Production verification

Before merging and deploying:

1. Submit a test lead from `contact.html`.
2. Confirm the lead appears in `public.leads`.
3. Confirm a `lead_created` event exists.
4. Submit the same phone again and confirm `duplicate_count` increases.
5. Complete Roof Check and confirm a linked row appears in `public.reports`.
6. Confirm the email and Google Sheets copy, if configured.
7. Confirm an anonymous visitor cannot select any rows from CRM tables.

## Security rules

- Do not commit `.env` files.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` in GitHub Pages.
- Do not make the `lead-reports` bucket public.
- Do not add direct anonymous insert policies to `leads`; all public submissions go through the Edge Function.

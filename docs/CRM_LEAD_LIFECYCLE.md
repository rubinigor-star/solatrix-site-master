# Roof Check lead lifecycle

Roof Check continues to use the existing `public.leads` and `public.lead_events` CRM tables. No separate abandoned-lead table is introduced.

## Lifecycle

1. The address step remains locked until the browser has a valid Israeli mobile number and explicit consent.
2. The `submit-lead` Edge Function creates one `started` lead for the stable browser `session_id`.
3. Calculator changes are sent through a debounced `activity` request. The same lead receives a new `calculator_step` and `last_activity_at`.
4. PDF submission uses the same `session_id`, stores the report, and changes the lead to `completed`.
5. The scheduled database function changes `started` to `abandoned` after 24 hours without activity and inserts a `lead_abandoned` event.
6. A returning calculator session sends `start`; an `abandoned` lead returns to `started` and receives a `lead_resumed` event.

CRM lifecycle statuses are limited to `started`, `completed`, `abandoned`, `contacted`, `qualified`, and `lost`. `calculator_step` is independent of CRM status.

## Deployment order

1. Apply `supabase/migrations/20260722_003_roof_check_lead_lifecycle.sql`.
2. Deploy the existing `submit-lead` Edge Function from `supabase/functions/submit-lead`.
3. Confirm the `solatrix-abandon-inactive-roof-check-leads` job exists in `cron.job` with the `*/15 * * * *` schedule.
4. Confirm the Edge Function still has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Email and Google Sheets secrets remain optional and are used only on completion.

The migration maps historical submitted leads to the new status set before installing the new status constraint. It is intentionally not applied automatically by the website build.

# Solatrix Roof Check production readiness

## Verified in the repository

- Production bundle completes successfully from the locked dependency tree.
- Financial model tests cover residential, commercial, VAT, degradation, ROI, payback, and the 25-year projection.
- Lead lifecycle tests cover consent gating, one-session transitions, abandonment eligibility, and resume.
- Geometry tests cover area, centroid coordinates, bounds, and valid closed GeoJSON.
- PDF Version 2 is the sole PDF path and was rendered as four A4 pages with Hebrew, RTL, parentheses, `kWp`, `kWh`, `₪`, WhatsApp, and roof coordinates.
- CRM reads the existing `leads`, `lead_events`, `reports`, and `tasks` tables and keeps report storage private.
- The public Edge Function rejects malformed JSON, requests above 12 MiB, invalid phone/consent data, PDFs above 8 MiB, and excessive new-lead requests from the same hashed IP window.
- Dependency versions previously declared as `latest` are pinned to the versions in `package-lock.json`.
- No GovMap token or server secret is bundled into the client. The Supabase browser key is a publishable key and protected data remains behind RLS.

## Production blockers

1. `npm audit --omit=dev` reports a critical `jsPDF` advisory chain and moderate `dompurify` advisories. npm reports no fix currently available. The project does not call jsPDF HTML, AcroForm, addJS, GIF, or arbitrary local-file APIs, and PDF input lengths are now capped, but the unresolved audit result still requires an explicit security decision or a separately validated replacement before production approval.
2. Migration `20260722_003_roof_check_lead_lifecycle.sql` has not been applied to the target Supabase project.
3. The updated `submit-lead` Edge Function has not been deployed to the target Supabase project.
4. The complete flow has not been executed against real authenticated CRM data after migration.
5. WhatsApp delivery is still represented as `pending_whatsapp_connection`; no business messaging provider sends the stored PDF automatically.
6. Real-device Safari, iOS touch drawing, Android Chrome, and production-host security headers have not been verified in this workspace.

## Manual checks before production

### Infrastructure

- Back up the Supabase database and apply the lifecycle migration in staging first.
- Confirm historical `new/contact_required` rows map to `completed` and sales workflow rows map to `qualified` or `lost` as intended.
- Confirm the `solatrix-abandon-inactive-roof-check-leads` cron job exists and executes with the service role.
- Deploy `supabase/functions/submit-lead`, confirm required secrets, and exercise 400, 413, 429, and successful responses.
- Verify RLS with viewer, manager, admin, anonymous, and expired-session accounts.
- Confirm `lead-reports` remains private and CRM signed URLs expire.

### Full customer flow

- Confirm no lead row exists before both a valid phone and consent.
- Confirm exactly one `started` lead after the gate, with stable `session_id`.
- Move through address, roof type, marking, obstacles, analysis, and report; confirm `calculator_step` and `last_activity_at` updates.
- Draw, edit, clear, and redraw multiple polygons; compare displayed area with CRM GeoJSON and report `roof_data`.
- Generate PDF Version 2, submit once and twice rapidly, and confirm one lead becomes `completed` without a duplicate lead.
- Confirm PDF storage, CRM download, financial values, coordinates, and the approved WhatsApp number.
- Age a staging lead beyond 24 hours, run/await cron, and confirm `lead_abandoned`; reopen its browser session and confirm `lead_resumed` plus `started`.

### Browsers and layout

- Chrome desktop at 1440, 1280, and 1024 CSS pixels.
- Chrome Android at narrow portrait and landscape sizes.
- Safari macOS current and previous supported version.
- Safari iPhone with touch point placement, vertex dragging, zoom, back navigation, and PDF download/open.
- Confirm keyboard focus, consent label activation, screen-reader labels, and no horizontal overflow in CRM or Roof Check.

### Hosting and monitoring

- Configure CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS at the production host after validating required map/font/image origins.
- Monitor Edge Function 4xx/5xx rates, cron executions, report upload failures, Resend failures, and Google Sheets webhook failures.
- Decide whether WhatsApp delivery remains manual or connect an approved provider in a separate scoped change.

No production deployment was performed during this hardening work.

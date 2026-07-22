# Solatrix Roof Check production audit

Audit date: 2026-07-22  
Repository: `rubinigor-star/solatrix-site-master`  
Baseline commit: `202006b`

## Scope and constraints

This audit documents the existing product before production hardening. It does not propose a replacement application or a redesign. PDF Version 2 (`src/reportPdfClient.js`) is the required production PDF.

## Application architecture

- Vite builds a multi-page static site. `vite.config.js` declares the site pages and injects common lead and navigation modules into public pages.
- Roof Check is served by `roof-check/index.html`.
- The calculator starts in `src/roofCheckApp.js` and is progressively enhanced by the ordered patch modules loaded from `roof-check/index.html`.
- Shared browser state is currently passed through DOM fields, `localStorage`, and documented `window.__solatrix*` values.
- The map, calculation display, PDF request form, and report display are enhancements around the existing calculator rather than separate applications.
- `admin.html` loads `src/adminApp.js`, which is the existing Supabase-backed CRM. `src/leadsStore.js` is a legacy/local-development lead store and is not the production CRM authority.

## Financial model

- The intended centralized authority is `src/roofCheckEconomics.js`.
- PDF Version 2 imports and validates that model in `src/reportPdfClient.js`.
- PDF Version 3 existed as a preview/experimental path at the audited baseline and was removed from production inputs during hardening.
- Screen calculations are still duplicated in `src/roofCheckApp.js`, `src/roofCheckMapPatch.js`, `src/roofCalculationConsistencyPatch.js`, and supporting report patches.
- These duplicated paths use different assumptions in places, including self-consumption share, commercial export tariff, electricity-price growth, and urban premium logic. This is the main financial consistency risk.
- No unit-test runner or financial unit tests existed at the audited baseline.

## PDF

- Production request flow: `src/reportUxFix.js` -> `createRoofCheckPdf()` in `src/reportPdfClient.js` -> PDF base64 -> `submit-lead` Edge Function -> private `lead-reports` storage.
- PDF Version 2 is previewed by `pdf-preview.html` and `src/pdfPreview.js`.
- Version 2 is the only retained PDF preview and generation path.
- `vite.config.js` currently applies build-time textual and layout patches specifically to `src/reportPdfClient.js`. These patches are part of the effective Version 2 output and must be considered in every PDF verification.
- Hebrew/RTL rendering uses an embedded Heebo font plus `src/reportTypographyPatch.js` for mixed-direction punctuation handling.
- The legacy printable HTML report remains in `src/pdfReport.js`; it is not the PDF submitted by the current WhatsApp report request flow.

## CRM and lead flow

- Production CRM tables already exist: `public.leads`, `public.lead_events`, `public.reports`, `public.tasks`, and `public.profiles`.
- Existing migrations are `20260710_001_crm_foundation.sql` and `20260710_002_crm_lead_details.sql`.
- Completed report requests are submitted through `src/lib/leadApi.js` to the `submit-lead` Edge Function.
- `submit-lead` validates name, Israeli mobile phone, email, and consent; deduplicates recent leads by normalized phone; stores reports; writes a lead event; and optionally calls Resend and a Google Sheets webhook.
- The existing status vocabulary does not yet match the requested calculator lifecycle. Started, completed, and abandoned lifecycle fields are absent.
- The browser currently creates the production lead only at report submission. There is no started-lead upsert, activity debounce, return/resume transition, or scheduled abandonment job.
- The CRM already reads and edits leads, tasks, reports, and events. It needs extension, not replacement.

## Map and GovMap

- The current integration is token-free and does not use a GovMap API token.
- Despite historical `data-govmap-*` names, the implementation uses Leaflet 1.9.4, Nominatim geocoding, Overpass building lookup, and Esri World Imagery tiles.
- Roof polygons are drawn as geographic latitude/longitude points. Area is calculated from polygon geometry and published through `window.__solatrixRoofSurfaces`.
- Vertex editing and mobile targeting are separate compatibility patches.
- Coordinates and polygon points exist in runtime state, but a canonical GeoJSON payload is not yet persisted to the CRM/report contract.
- The map provider must remain replaceable behind the existing surface-data contract so a future GovMap API adapter can be added without changing the calculator or CRM.

## Existing Edge Functions and integrations

- Edge Functions: one function, `supabase/functions/submit-lead/index.ts`.
- Supabase: Auth, Postgres, RLS, private Storage bucket, Edge Functions.
- Optional notifications: Resend (`RESEND_API_KEY`, `LEAD_NOTIFICATION_EMAIL`, `LEAD_FROM_EMAIL`).
- Optional CRM export: Google Sheets webhook (`GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEETS_WEBHOOK_SECRET`).
- WhatsApp is currently a contact/delivery-request channel. The site stores a pending delivery request, but no WhatsApp Business sending Edge Function exists.
- Public map dependencies: unpkg Leaflet, Nominatim, Overpass, Esri World Imagery, and Wikidata for urban-population lookup.
- Public visual dependencies include Google Fonts, Wix-hosted logo assets, and GitHub-hosted PDF imagery/font files.

## Security observations

- The Supabase publishable key in the browser client is expected to be public; RLS and Edge Function validation remain the security boundary.
- Public forms do not write directly to CRM tables at the audited baseline.
- The Edge Function uses the service-role key and therefore must remain the only public write path.
- PDF uploads are validated for size and `%PDF-` signature and stored in a private bucket.
- External geocoding and map services receive address or coordinate data. This must be reflected in the production privacy review.
- CDN/runtime dependencies currently lack local fallback or integrity pinning.

## Baseline build

`npm run build` succeeds on Node/npm in the audit environment after installing dependencies. Vite transformed 282 modules and emitted all configured pages, including both PDF previews, Roof Check, and CRM.

## Required production work identified by this audit

1. Replace every obsolete Solatrix contact number with the approved number.
2. Make `roofCheckEconomics.js` the only financial calculation authority for screen, CRM payload, and Version 2 PDF.
3. Add deterministic unit tests for residential, commercial, VAT, degradation, payback, ROI, and the 25-year projection.
4. Keep Version 2 as the sole production PDF without changing its structure.
5. Extend the existing lead schema and Edge Function for idempotent started/completed activity updates and event history.
6. Add a scheduled database job for the 24-hour started-to-abandoned transition.
7. Persist calculator step, session id, timestamps, GeoJSON, coordinates, area, and calculation model in the existing CRM records.
8. Extend existing CRM filters and event-history presentation for the requested lifecycle statuses.
9. Verify the complete browser flow and PDF visually before production deployment.

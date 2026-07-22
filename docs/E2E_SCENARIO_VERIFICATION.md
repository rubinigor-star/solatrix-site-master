# Roof Check end-to-end scenario verification

## Automated contract coverage

The repository test suite verifies the lifecycle contract used by the existing `submit-lead` Edge Function:

1. valid phone plus consent creates `started`;
2. calculator activity preserves `started` and produces `lead_activity`;
3. completion changes the same lifecycle to `completed` and produces `lead_completed`;
4. exactly 24 hours without activity makes only a `started` lead eligible for abandonment;
5. return from `abandoned` changes the same lifecycle to `started` and produces `lead_resumed`;
6. calculator activity cannot overwrite `completed`, `contacted`, `qualified`, or `lost`;
7. roof polygons produce area, coordinates, bounds, and closed GeoJSON;
8. the financial calculation and 25-year projection remain covered by the centralized economics tests.

The production build also verifies that the phone/consent gate, map geometry adapter, PDF Version 2 client, CRM, and report submit path bundle together.

## Infrastructure-dependent verification still required

The following checks cannot be represented as passed until the migration and Edge Function are applied to the target Supabase project:

- enter a real valid phone and consent and confirm one `started` row;
- progress through every calculator route and confirm `calculator_step` and `last_activity_at` updates on that row;
- mark a real roof and confirm GeoJSON in lead metadata and completed report `roof_data`;
- request PDF and confirm the same lead becomes `completed`, one report row is written, and the private PDF object opens from CRM;
- age a test `started` row beyond 24 hours and confirm the cron job creates `lead_abandoned`;
- reopen the same browser session and confirm `lead_resumed` and `started`;
- confirm CRM filters and event history against real authenticated data.

No production deployment or remote database mutation is performed by repository tests.

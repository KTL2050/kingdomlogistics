# Shipment Control Tower

A logistics control-tower dashboard for tracking container shipments end to
end — live map, shipment status, milestone timelines, and exceptions/alerts.
Built with Next.js (App Router), TypeScript, and Tailwind CSS, and wired for
Supabase (Postgres + Auth + Realtime) as the backend.

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. The app works immediately with no setup — it
reads from realistic mock data in `lib/mock-data.ts` until you connect a
real Supabase project (see below).

## Project structure

```
app/                    Routes (App Router)
  page.tsx              Main control tower dashboard ("Containers")
  overview/              Executive summary
  shipments/             Shipment list + /shipments/[container] detail
  map/                   Full-page live map
  alerts/                Exceptions & alerts, grouped by severity
  reports/               Charts and analytics
  settings/              Profile, role, backend connection status

components/
  layout/                Sidebar, Header, AppShell
  dashboard/             KpiCard, TrackingMap, MilestoneTimeline, panels
  shipments/             ShipmentsTable
  reports/               ReportsCharts (Recharts)
  ui/                    StatusBadge, SearchBar, FilterTabs

lib/
  data.ts                Single data-access layer — every page imports
                          from here, never from mock-data.ts or supabase/
                          directly. Swapping to live data only ever
                          touches this file.
  mock-data.ts            Bundled sample data (5 detailed + 6 lighter
                          shipments, matching the KPI counts shown on
                          the dashboard).
  supabase/client.ts       Supabase client — safe to import even with no
                          project configured (isSupabaseConfigured flag).
  supabase/schema.sql      Full Postgres schema: tables, indexes, RLS
                          policies, and Realtime publication.
  utils.ts                 Status colors, badge labels, class helpers.

types/index.ts            Shared TypeScript types.
```

## Connecting a real Supabase project

The app is structured so this is the only thing you need to do to go from
mock data to a live, real-time backend:

1. Create a project at https://supabase.com.
2. In the Supabase dashboard, open **SQL Editor** and run the contents of
   `lib/supabase/schema.sql`. This creates every table (shipments,
   containers, container_locations, shipment_milestones,
   shipment_status_history, alerts, notifications, documents, users,
   locations), sets up Row Level Security policies, and enables Realtime
   on the tables the dashboard subscribes to.
3. Copy `.env.local.example` to `.env.local` and fill in your project's
   URL and anon key (Project Settings → API).
4. Set up Supabase Auth (email/password or your preferred provider) and
   insert a row into `users` for each person, with a `role` of `Admin`,
   `Logistics Manager`, `Operations Officer`, or `Viewer`.
5. Insert real shipment/container rows (or build a small import script)
   — the shape to match is in `types/index.ts` and `schema.sql`.
6. Restart the dev server. `lib/data.ts` will detect the environment
   variables and start reading from Supabase instead of the mock data;
   the Settings page also shows a live "Connected to Supabase" indicator
   once this is working.

Realtime updates (a container's location or status changing without a
page refresh) require subscribing to Supabase's Realtime channel from a
client component — the schema already has replication enabled on the
relevant tables, so this is a matter of adding a `useEffect` with
`supabase.channel(...)` where you want live updates (e.g., in
`TrackingMapInner.tsx`), rather than a backend change.

## Design notes

The palette, typography, and layout intentionally follow one reference
direction throughout: a deep navy sidebar, a white workspace, Inter as
the only typeface, and restrained status colors (green/red/amber/blue)
used consistently for on-time/delayed/not-started/informational states
everywhere in the app — KPI cards, badges, the map, and alerts all share
the same vocabulary so a user only has to learn it once.

The map uses Leaflet with CARTO's light basemap tiles (no API key
required) rather than Mapbox, since no Mapbox token was available in
this environment — swap the `TileLayer` in
`components/dashboard/TrackingMapInner.tsx` for Mapbox GL if you have a
key and want vector tiles.

## What's mocked vs. real

- **Real**: the full frontend, component architecture, TypeScript types,
  Tailwind design system, map rendering, charts, and the complete
  Supabase SQL schema with RLS and Realtime already configured.
- **Mocked until you connect Supabase**: the actual shipment data, auth
  session, and realtime push updates — these need your own Supabase
  project and credentials, which no one outside your organization can
  provision on your behalf.

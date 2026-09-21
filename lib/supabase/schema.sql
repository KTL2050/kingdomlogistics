-- Shipment Control Tower — Supabase schema
-- Run this in the Supabase SQL editor (or via the CLI: supabase db push)
-- after creating a new project. Requires the pgcrypto extension for
-- gen_random_uuid(), which Supabase enables by default.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Reference tables
-- ---------------------------------------------------------------------

create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text,
  latitude double precision not null,
  longitude double precision not null,
  kind text check (kind in ('origin', 'port', 'icd', 'store', 'waypoint')) not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Users & roles
-- Supabase Auth owns the actual credentials in auth.users; this table
-- holds the app-facing profile and role used for Row Level Security.
-- ---------------------------------------------------------------------

create table if not exists users (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('Admin', 'Logistics Manager', 'Operations Officer', 'Viewer')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Shipments & containers
-- ---------------------------------------------------------------------

create table if not exists shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_number text not null unique,
  origin text not null,
  destination text not null,
  shipping_line text not null,
  mode text not null check (mode in ('FCL', 'LCL', 'Air', 'Breakbulk')),
  etd date not null,
  eta date not null,
  final_eta date,
  current_status text not null default 'Order Placed',
  current_location text,
  health text not null default 'not_started' check (health in ('on_time', 'delayed', 'not_started', 'completed')),
  delay_days integer not null default 0,
  customer text not null,
  assigned_manager uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists containers (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  container_number text not null unique,
  container_size text not null check (container_size in ('20ft', '40ft', '40ft HC', '45ft')),
  container_type text not null default 'Dry',
  status text not null default 'Order Placed',
  last_update timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists container_locations (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers (id) on delete cascade,
  location_id uuid references locations (id),
  latitude double precision not null,
  longitude double precision not null,
  label text,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_container_locations_container_id
  on container_locations (container_id, recorded_at desc);

-- ---------------------------------------------------------------------
-- Milestones
-- ---------------------------------------------------------------------

create table if not exists shipment_milestones (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  step_order integer not null,
  name text not null,
  status text not null default 'pending' check (status in ('completed', 'current', 'delayed', 'pending')),
  planned_date date,
  actual_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shipment_id, step_order)
);

create index if not exists idx_shipment_milestones_shipment_id
  on shipment_milestones (shipment_id, step_order);

create table if not exists shipment_status_history (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  status text not null,
  location text,
  changed_at timestamptz not null default now(),
  changed_by uuid references users (id)
);

-- ---------------------------------------------------------------------
-- Alerts & notifications
-- ---------------------------------------------------------------------

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid references shipments (id) on delete cascade,
  -- Denormalized alongside shipment_id (like container_number on
  -- planned_orders) so the alert still carries a usable shipment
  -- reference — and AlertCard's link to /shipments/[container] still
  -- resolves — even without a join back through shipment_id.
  shipment_number text,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  description text not null,
  acknowledged boolean not null default false,
  -- A manager's justification for this specific delay — separate from
  -- `description` (auto-generated at the moment the alert was raised)
  -- so it can be added or edited afterwards without losing the original.
  manager_note text,
  manager_note_by text,
  manager_note_at timestamptz,
  created_at timestamptz not null default now()
);

-- Safe to run again on an alerts table that predates these columns.
alter table alerts add column if not exists shipment_number text;
alter table alerts add column if not exists manager_note text;
alter table alerts add column if not exists manager_note_by text;
alter table alerts add column if not exists manager_note_at timestamptz;

create index if not exists idx_alerts_shipment_id on alerts (shipment_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  alert_id uuid references alerts (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references shipments (id) on delete cascade,
  name text not null,
  file_path text not null,
  uploaded_by uuid references users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Stage durations
-- stage_durations is the default (days expected per step) applied to
-- every container. container_stage_durations lets an individual
-- container override any subset of those steps — a row here always
-- wins over the matching default, so two containers on the same route
-- can legitimately take different numbers of days.
-- ---------------------------------------------------------------------

create table if not exists stage_durations (
  id uuid primary key default gen_random_uuid(),
  step_name text not null unique,
  expected_days integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists container_stage_durations (
  id uuid primary key default gen_random_uuid(),
  container_number text not null,
  step_name text not null,
  expected_days integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (container_number, step_name)
);

create index if not exists idx_container_stage_durations_container
  on container_stage_durations (container_number);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_shipments_updated_at
  before update on shipments
  for each row execute function set_updated_at();

create trigger trg_milestones_updated_at
  before update on shipment_milestones
  for each row execute function set_updated_at();

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- Dropped first (unlike the triggers above) because stage_durations may
-- already exist in a project set up before this table was added to this
-- file, complete with its own same-named trigger — plain `create
-- trigger` has no "if not exists" form and would error on that collision.
drop trigger if exists trg_stage_durations_updated_at on stage_durations;
create trigger trg_stage_durations_updated_at
  before update on stage_durations
  for each row execute function set_updated_at();

drop trigger if exists trg_container_stage_durations_updated_at on container_stage_durations;
create trigger trg_container_stage_durations_updated_at
  before update on container_stage_durations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- All authenticated users can read; only Admin/Logistics Manager/
-- Operations Officer can write. Adjust per your real access rules.
-- ---------------------------------------------------------------------

alter table shipments enable row level security;
alter table containers enable row level security;
alter table container_locations enable row level security;
alter table shipment_milestones enable row level security;
alter table shipment_status_history enable row level security;
alter table alerts enable row level security;
alter table notifications enable row level security;
alter table documents enable row level security;
alter table users enable row level security;
alter table stage_durations enable row level security;
alter table container_stage_durations enable row level security;

create policy "Authenticated users can read shipments"
  on shipments for select to authenticated using (true);

create policy "Managers and officers can write shipments"
  on shipments for insert to authenticated with check (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

create policy "Managers and officers can update shipments"
  on shipments for update to authenticated using (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

create policy "Authenticated users can read containers"
  on containers for select to authenticated using (true);

create policy "Authenticated users can read container_locations"
  on container_locations for select to authenticated using (true);

create policy "Authenticated users can read milestones"
  on shipment_milestones for select to authenticated using (true);

create policy "Authenticated users can read alerts"
  on alerts for select to authenticated using (true);

-- alerts previously had no write policies at all, which — since RLS
-- defaults to deny — meant the insert calls in actions.ts /
-- ManualProgressForm.tsx and the Acknowledge button in AlertCard.tsx
-- could never actually succeed against a real Supabase project.
create policy "Managers and officers can create alerts"
  on alerts for insert to authenticated with check (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

-- Any authenticated user can acknowledge an alert (matches AlertCard's
-- existing behavior, which has no role check) — the manager-note fields
-- on this same row are restricted to managers at the UI level instead,
-- same pattern this app already uses elsewhere for finer-grained access.
create policy "Authenticated users can update alerts"
  on alerts for update to authenticated using (true);

create policy "Users can read their own notifications"
  on notifications for select to authenticated using (user_id = auth.uid());

create policy "Users can read their own profile"
  on users for select to authenticated using (id = auth.uid());

-- Dropped first for the same reason as the triggers above — these tables
-- may already exist in a project set up before this file covered them.
drop policy if exists "Authenticated users can read stage_durations" on stage_durations;
create policy "Authenticated users can read stage_durations"
  on stage_durations for select to authenticated using (true);

drop policy if exists "Managers and officers can write stage_durations" on stage_durations;
create policy "Managers and officers can write stage_durations"
  on stage_durations for insert to authenticated with check (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

drop policy if exists "Managers and officers can update stage_durations" on stage_durations;
create policy "Managers and officers can update stage_durations"
  on stage_durations for update to authenticated using (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

drop policy if exists "Authenticated users can read container_stage_durations" on container_stage_durations;
create policy "Authenticated users can read container_stage_durations"
  on container_stage_durations for select to authenticated using (true);

drop policy if exists "Managers and officers can write container_stage_durations" on container_stage_durations;
create policy "Managers and officers can write container_stage_durations"
  on container_stage_durations for insert to authenticated with check (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

drop policy if exists "Managers and officers can update container_stage_durations" on container_stage_durations;
create policy "Managers and officers can update container_stage_durations"
  on container_stage_durations for update to authenticated using (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

drop policy if exists "Managers and officers can delete container_stage_durations" on container_stage_durations;
create policy "Managers and officers can delete container_stage_durations"
  on container_stage_durations for delete to authenticated using (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

-- ---------------------------------------------------------------------
-- Realtime
-- Enable replication on the tables the dashboard subscribes to, so
-- Supabase Realtime pushes changes to connected clients.
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table shipments;
alter publication supabase_realtime add table containers;
alter publication supabase_realtime add table container_locations;
alter publication supabase_realtime add table shipment_milestones;
alter publication supabase_realtime add table alerts;

-- ---------------------------------------------------------------------
-- Order planning
-- Recurring "when to place the next order" schedules per company.
-- anchor_date is any one real occurrence (past or future) — the app
-- walks forward from it by `frequency` to find the next due date, and
-- surfaces a daily reminder once that date is within lead_time_days.
-- ---------------------------------------------------------------------

create table if not exists planned_orders (
  id uuid primary key default gen_random_uuid(),
  company text not null check (company in ('Uncle Bills', 'Aiwibi Uganda')),
  frequency text not null check (frequency in ('monthly', 'quarterly', 'yearly', 'custom')),
  custom_interval_days integer,
  anchor_date date not null,
  lead_time_days integer not null default 7,
  notes text,
  active boolean not null default true,
  -- The container this schedule's most recently placed order became —
  -- set when marking an order as placed, so the Order Planning export
  -- can pull that container's real Mombasa ETA / Store Date.
  container_number text,
  container_size text check (container_size in ('20ft', '40ft', '40ft HC', '45ft')),
  -- Brought in from a bulk Excel/CSV import when there's no live-tracked
  -- shipment for container_number to read the real values from instead.
  imported_mombasa_eta text,
  imported_store_date text,
  imported_actual text,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe to run again on a planned_orders table that predates these
-- columns (e.g. already created from an earlier version of this file).
alter table planned_orders add column if not exists container_number text;
alter table planned_orders add column if not exists container_size text;
alter table planned_orders add column if not exists imported_mombasa_eta text;
alter table planned_orders add column if not exists imported_store_date text;
alter table planned_orders add column if not exists imported_actual text;

create index if not exists idx_planned_orders_company on planned_orders (company);

create trigger trg_planned_orders_updated_at
  before update on planned_orders
  for each row execute function set_updated_at();

alter table planned_orders enable row level security;

create policy "Authenticated users can read planned_orders"
  on planned_orders for select to authenticated using (true);

create policy "Managers and officers can write planned_orders"
  on planned_orders for insert to authenticated with check (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

create policy "Managers and officers can update planned_orders"
  on planned_orders for update to authenticated using (
    exists (
      select 1 from users
      where users.id = auth.uid()
      and users.role in ('Admin', 'Logistics Manager', 'Operations Officer')
    )
  );

alter publication supabase_realtime add table planned_orders;

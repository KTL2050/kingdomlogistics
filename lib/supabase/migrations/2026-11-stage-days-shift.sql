-- Stage days shift (one time).
--
-- A stage's number of days used to mean "how long the container stays at this
-- stage before moving on". It now means "how many days it takes to REACH this
-- stage from the one before it", so the 45 days that sat on Order Placed now
-- sit on Container Loaded. This moves every saved number down one stage so no
-- planned date changes.
--
-- Run it ONCE, at the same moment the new calculation (lib/planning.ts) goes
-- live. It keeps backup copies of both tables and refuses to run a second time.
--
-- To undo (only if needed), restore from the backups:
--   delete from stage_durations;
--   insert into stage_durations select * from stage_durations_before_shift;
--   delete from container_stage_durations;
--   insert into container_stage_durations select * from container_stage_durations_before_shift;

do $$ begin
  if to_regclass('public.stage_durations_before_shift') is not null then
    raise exception 'The stage-days shift has already been run - do not run it twice.';
  end if;
end $$;

-- Backups, so this can be undone.
create table stage_durations_before_shift as select * from stage_durations;
create table container_stage_durations_before_shift as select * from container_stage_durations;

-- DEFAULTS: each stage takes the number that used to sit on the stage before it.
create temp table step_shift (country text, step_name text, from_step text);
insert into step_shift values
  ('Uganda', 'Container Loaded', 'Order Placed'),
  ('Uganda', 'On the High Seas', 'Container Loaded'),
  ('Uganda', 'Mombasa Port', 'On the High Seas'),
  ('Uganda', 'Enroute to Kampala', 'Mombasa Port'),
  ('Uganda', 'At ICD', 'Enroute to Kampala'),
  ('Uganda', 'Arrived at Store', 'At ICD'),
  ('Kenya', 'Container Loaded', 'Order Placed'),
  ('Kenya', 'On the High Seas', 'Container Loaded'),
  ('Kenya', 'Mombasa Port', 'On the High Seas'),
  ('Kenya', 'Enroute to Nairobi', 'Mombasa Port'),
  ('Kenya', 'At Nairobi Depot', 'Enroute to Nairobi'),
  ('Kenya', 'Arrived at Store', 'At Nairobi Depot');

insert into stage_durations (country, step_name, expected_days)
select s.country, s.step_name, coalesce(o.expected_days, 1)
from step_shift s
left join stage_durations_before_shift o on o.country = s.country and o.step_name = s.from_step
on conflict (country, step_name) do update set expected_days = excluded.expected_days;

update stage_durations set expected_days = 1 where step_name = 'Order Placed';

-- PER-CONTAINER numbers: each container is shifted along ITS OWN route, so
-- Aiwibi (with Manufacturing, no depot) and Uncle Bills (depot, no
-- Manufacturing) both keep their dates.
create temp table route_steps (country text, company text, pos int, step_name text);
insert into route_steps values
  ('Uganda', 'UncleBills', 1, 'Order Placed'), ('Uganda', 'UncleBills', 2, 'Container Loaded'),
  ('Uganda', 'UncleBills', 3, 'On the High Seas'), ('Uganda', 'UncleBills', 4, 'Mombasa Port'),
  ('Uganda', 'UncleBills', 5, 'Enroute to Kampala'), ('Uganda', 'UncleBills', 6, 'At ICD'),
  ('Uganda', 'UncleBills', 7, 'Arrived at Store'),
  ('Uganda', 'Aiwibi', 1, 'Order Placed'), ('Uganda', 'Aiwibi', 2, 'Manufacturing and Packaging'),
  ('Uganda', 'Aiwibi', 3, 'Container Loaded'), ('Uganda', 'Aiwibi', 4, 'On the High Seas'),
  ('Uganda', 'Aiwibi', 5, 'Mombasa Port'), ('Uganda', 'Aiwibi', 6, 'Enroute to Kampala'),
  ('Uganda', 'Aiwibi', 7, 'Arrived at Store'),
  ('Kenya', 'UncleBills', 1, 'Order Placed'), ('Kenya', 'UncleBills', 2, 'Container Loaded'),
  ('Kenya', 'UncleBills', 3, 'On the High Seas'), ('Kenya', 'UncleBills', 4, 'Mombasa Port'),
  ('Kenya', 'UncleBills', 5, 'Enroute to Nairobi'), ('Kenya', 'UncleBills', 6, 'At Nairobi Depot'),
  ('Kenya', 'UncleBills', 7, 'Arrived at Store'),
  ('Kenya', 'Aiwibi', 1, 'Order Placed'), ('Kenya', 'Aiwibi', 2, 'Manufacturing and Packaging'),
  ('Kenya', 'Aiwibi', 3, 'Container Loaded'), ('Kenya', 'Aiwibi', 4, 'On the High Seas'),
  ('Kenya', 'Aiwibi', 5, 'Mombasa Port'), ('Kenya', 'Aiwibi', 6, 'Enroute to Nairobi'),
  ('Kenya', 'Aiwibi', 7, 'Arrived at Store');

-- New number for each stage = the OLD effective number of the stage before it
-- (the container's own override if it had one, else the old default, else 1).
create temp table new_effective as
select sh.country, sh.container_number, r.step_name,
       coalesce(o.expected_days, d.expected_days, 1) as days
from shipments sh
join route_steps r
  on r.country = sh.country
 and r.company = case when upper(left(sh.container_number, 1)) = 'A' then 'Aiwibi' else 'UncleBills' end
 and r.pos > 1
join route_steps prev
  on prev.country = r.country and prev.company = r.company and prev.pos = r.pos - 1
left join container_stage_durations_before_shift o
  on o.container_number = sh.container_number and o.country = sh.country and o.step_name = prev.step_name
left join stage_durations_before_shift d
  on d.country = sh.country and d.step_name = prev.step_name;

-- Rewrite each container's own numbers: keep only the ones that differ from
-- the new defaults.
delete from container_stage_durations c
using shipments sh
where c.container_number = sh.container_number and c.country = sh.country;

insert into container_stage_durations (container_number, country, step_name, expected_days)
select n.container_number, n.country, n.step_name, n.days
from new_effective n
left join stage_durations d on d.country = n.country and d.step_name = n.step_name
where n.days is distinct from coalesce(d.expected_days, 1);

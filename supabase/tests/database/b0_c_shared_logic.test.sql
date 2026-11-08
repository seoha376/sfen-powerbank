begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_column(
  'public',
  'system_settings',
  'demo_mode_enabled',
  'system settings include the administrator demo switch'
);
select has_column(
  'public',
  'rentals',
  'simulation_elapsed_seconds',
  'rentals preserve accumulated simulated time'
);
select has_column(
  'public',
  'batteries',
  'charge_simulation_elapsed_seconds',
  'charging preserves accumulated simulated time'
);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000801',
    'authenticated',
    'authenticated',
    '20260011@students.sfen.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000899',
    'authenticated',
    'authenticated',
    'b0c-admin@example.com',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.app_users (
  user_id,
  auth_user_id,
  user_name,
  role,
  approval_status,
  eligibility_status
)
values
  (
    '20260011',
    '00000000-0000-0000-0000-000000000801',
    'Clock Test User',
    'user',
    'Approved',
    true
  ),
  (
    'b0c-admin',
    '00000000-0000-0000-0000-000000000899',
    'Clock Test Administrator',
    'administrator',
    null,
    true
  );

insert into public.stations (
  station_id,
  station_name,
  location,
  slot_capacity
)
values (
  '00000000-0000-0000-0000-000000000901',
  'Clock Test Station',
  'Test Lab',
  2
);

insert into public.batteries (
  battery_id,
  model_name,
  capacity,
  cycle_life,
  status,
  station_id,
  current_charge,
  charge_started_at
)
values (
  '00000000-0000-0000-0000-000000000902',
  'CLOCK-10K',
  10000,
  500,
  'Charging',
  '00000000-0000-0000-0000-000000000901',
  20,
  now() - interval '2 minutes'
);

insert into public.rentals (
  rental_id,
  user_id,
  battery_id,
  rental_station_id,
  rental_time
)
values (
  '00000000-0000-0000-0000-000000000903',
  '20260011',
  '00000000-0000-0000-0000-000000000902',
  '00000000-0000-0000-0000-000000000901',
  now() - interval '2 minutes'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000801',
  true
);

select throws_ok(
  $$select public.set_simulation_time_scale(2, now())$$,
  '42501',
  null,
  'a normal user cannot change the simulation time scale'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000899',
  true
);

select throws_ok(
  $$select public.set_simulation_time_scale(2, now())$$,
  '42501',
  null,
  'an administrator cannot change time scale while demo mode is disabled'
);

reset role;
update public.system_settings
set demo_mode_enabled = true
where settings_id = 1;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000899',
  true
);

select throws_ok(
  $$update public.system_settings set time_scale = 2 where settings_id = 1$$,
  '42501',
  null,
  'an administrator must use the atomic checkpoint function'
);
select lives_ok(
  $$
    select public.set_simulation_time_scale(
      2,
      now() - interval '1 minute'
    )
  $$,
  'an administrator checkpoints active clocks before changing the scale'
);

reset role;

select is(
  (
    select simulation_elapsed_seconds
    from public.rentals
    where rental_id = '00000000-0000-0000-0000-000000000903'
  ),
  60::numeric,
  'the first real minute is preserved at scale 1'
);
select is(
  (
    select charge_simulation_elapsed_seconds
    from public.batteries
    where battery_id = '00000000-0000-0000-0000-000000000902'
  ),
  60::numeric,
  'the first charging minute is preserved at scale 1'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000899',
  true
);
select lives_ok(
  $$select public.set_simulation_time_scale(4, now())$$,
  'a later scale change checkpoints the prior scale segment'
);

reset role;

select is(
  (
    select simulation_elapsed_seconds
    from public.rentals
    where rental_id = '00000000-0000-0000-0000-000000000903'
  ),
  180::numeric,
  'past scale 1 and scale 2 segments are accumulated without retroactive change'
);
select is(
  (select time_scale from public.system_settings where settings_id = 1),
  4::numeric,
  'the new scale applies after all active clocks are checkpointed'
);

select * from finish();
rollback;

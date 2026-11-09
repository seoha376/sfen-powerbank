begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

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
    '00000000-0000-0000-0000-000000002101',
    'authenticated',
    'authenticated',
    '20261102@students.sfen.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000002199',
    'authenticated',
    'authenticated',
    'b1b-admin@example.com',
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
    '20261102',
    '00000000-0000-0000-0000-000000002101',
    'Battery Test User',
    'user',
    'Approved',
    true
  ),
  (
    'b1b-admin',
    '00000000-0000-0000-0000-000000002199',
    'Battery Test Administrator',
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
values
  (
    '00000000-0000-0000-0000-000000002201',
    'Battery Origin',
    'Engineering Hall',
    10
  ),
  (
    '00000000-0000-0000-0000-000000002202',
    'Battery Destination',
    'Library',
    10
  ),
  (
    '00000000-0000-0000-0000-000000002203',
    'Full Destination',
    'Student Center',
    1
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
values
  (
    '00000000-0000-0000-0000-000000002301',
    'RELOCATE-AVAILABLE',
    10000,
    500,
    'Available',
    '00000000-0000-0000-0000-000000002201',
    100,
    null
  ),
  (
    '00000000-0000-0000-0000-000000002302',
    'RELOCATE-CHARGING',
    10000,
    500,
    'Charging',
    '00000000-0000-0000-0000-000000002201',
    30,
    '2026-11-09 00:00:00+00'
  ),
  (
    '00000000-0000-0000-0000-000000002303',
    'RELOCATE-REPAIR',
    10000,
    500,
    'UnderRepair',
    '00000000-0000-0000-0000-000000002201',
    20,
    null
  ),
  (
    '00000000-0000-0000-0000-000000002304',
    'NO-RELOCATE-RENTED',
    10000,
    500,
    'Rented',
    '00000000-0000-0000-0000-000000002201',
    80,
    null
  ),
  (
    '00000000-0000-0000-0000-000000002305',
    'NO-RELOCATE-OVERDUE',
    10000,
    500,
    'Overdue',
    '00000000-0000-0000-0000-000000002201',
    70,
    null
  ),
  (
    '00000000-0000-0000-0000-000000002306',
    'NO-RELOCATE-LOST',
    10000,
    500,
    'Lost',
    '00000000-0000-0000-0000-000000002201',
    60,
    null
  ),
  (
    '00000000-0000-0000-0000-000000002307',
    'NO-RELOCATE-DISPOSED',
    10000,
    500,
    'Disposed',
    '00000000-0000-0000-0000-000000002201',
    0,
    null
  ),
  (
    '00000000-0000-0000-0000-000000002308',
    'FULL-STATION-BATTERY',
    10000,
    500,
    'Available',
    '00000000-0000-0000-0000-000000002203',
    100,
    null
  ),
  (
    '00000000-0000-0000-0000-000000002309',
    'CAPACITY-REJECT-SOURCE',
    10000,
    500,
    'Available',
    '00000000-0000-0000-0000-000000002201',
    100,
    null
  );

create function public.b1b_test_fail_history_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.battery_id = '00000000-0000-0000-0000-000000002399' then
    raise exception 'forced history failure for atomicity test'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger b1b_test_fail_history_insert
before insert on public.battery_status_history
for each row
execute function public.b1b_test_fail_history_insert();

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000002199',
  true
);

select lives_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002350',
      'B1B-10K',
      10000,
      500,
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  'an administrator can register a battery'
);
select results_eq(
  $$
    select
      model_name,
      capacity,
      cycle_life,
      used_count,
      status,
      station_id,
      current_charge,
      disposal_confirmed_at
    from public.admin_list_batteries()
    where battery_id = '00000000-0000-0000-0000-000000002350'
  $$,
  $$
    values (
      'B1B-10K'::text,
      10000,
      500,
      0,
      'Charging'::text,
      '00000000-0000-0000-0000-000000002201'::uuid,
      0,
      null::timestamptz
    )
  $$,
  'registration stores the required initial battery values'
);
select ok(
  (
    select
      battery.charge_started_at is not null
      and battery.charge_time_anchor_at = battery.charge_started_at
      and battery.charge_simulation_elapsed_seconds = 0
      and battery.charge_time_scale > 0
    from public.admin_list_batteries() as battery
    where battery.battery_id = '00000000-0000-0000-0000-000000002350'
  ),
  'registration initializes the B0-C charging clock'
);
select ok(
  (
    select
      history.from_status is null
      and history.to_status = 'Charging'
      and history.changed_by = 'b1b-admin'
      and history.station_id = '00000000-0000-0000-0000-000000002201'
      and history.changed_at = battery.charge_started_at
    from public.battery_status_history as history
    join public.admin_list_batteries() as battery
      on battery.battery_id = history.battery_id
    where history.battery_id = '00000000-0000-0000-0000-000000002350'
  ),
  'registration creates the initial Charging history at the same timestamp'
);

select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002350',
      'DUPLICATE',
      10000,
      500,
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  '23505',
  null,
  'duplicate battery IDs are rejected'
);
select is(
  (
    select count(*)::integer
    from public.battery_status_history
    where battery_id = '00000000-0000-0000-0000-000000002350'
  ),
  1,
  'a rejected duplicate does not create another history row'
);
select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002351',
      '',
      10000,
      500,
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  '22023',
  null,
  'registration requires a model name'
);
select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002352',
      'INVALID-CAPACITY',
      0,
      500,
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  '22023',
  null,
  'registration rejects a non-positive capacity'
);
select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002353',
      'INVALID-CYCLE',
      10000,
      0,
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  '22023',
  null,
  'registration rejects a cycle life below one'
);
select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002354',
      'NO-STATION',
      10000,
      500,
      '00000000-0000-0000-0000-000000009999'
    )
  $$,
  'P0002',
  null,
  'registration rejects a station that does not exist'
);
select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002355',
      'FULL-STATION',
      10000,
      500,
      '00000000-0000-0000-0000-000000002203'
    )
  $$,
  '23514',
  null,
  'registration rejects a station with no remaining slot'
);
select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002399',
      'ROLLBACK-CHECK',
      10000,
      500,
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  '23514',
  null,
  'a history failure aborts registration'
);
select is(
  (
    select count(*)::integer
    from public.admin_list_batteries()
    where battery_id = '00000000-0000-0000-0000-000000002399'
  ),
  0,
  'the battery insert rolls back when initial history creation fails'
);

select lives_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002301',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  'an Available battery can be relocated'
);
select lives_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002302',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  'a Charging battery can be relocated'
);
select lives_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002303',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  'an UnderRepair battery can be relocated'
);
select results_eq(
  $$
    select station_id, status
    from public.batteries
    where battery_id = '00000000-0000-0000-0000-000000002301'
  $$,
  $$
    values (
      '00000000-0000-0000-0000-000000002202'::uuid,
      'Available'::text
    )
  $$,
  'relocation changes only the station and preserves battery status'
);
select results_eq(
  $$
    select
      status,
      current_charge,
      charge_started_at,
      charge_simulation_elapsed_seconds,
      charge_time_anchor_at,
      charge_time_scale
    from public.admin_list_batteries()
    where battery_id = '00000000-0000-0000-0000-000000002302'
  $$,
  $$
    values (
      'Charging'::text,
      30,
      '2026-11-09 00:00:00+00'::timestamptz,
      0::numeric,
      '2026-11-09 00:00:00+00'::timestamptz,
      1::numeric
    )
  $$,
  'relocating a Charging battery preserves its status and charging progress'
);
select ok(
  (
    select
      history.from_status = 'Available'
      and history.to_status = 'Available'
      and history.station_id = '00000000-0000-0000-0000-000000002202'
      and history.changed_by = 'b1b-admin'
      and history.reason = 'Relocation'
    from public.battery_status_history as history
    where history.battery_id = '00000000-0000-0000-0000-000000002301'
  ),
  'relocation records a same-status history at the destination'
);

select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002304',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  '23514',
  null,
  'a Rented battery cannot be relocated'
);
select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002305',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  '23514',
  null,
  'an Overdue battery cannot be relocated'
);
select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002306',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  '23514',
  null,
  'a Lost battery cannot be relocated'
);
select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002307',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  '23514',
  null,
  'a Disposed battery cannot be relocated'
);
select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002301',
      '00000000-0000-0000-0000-000000002202',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  '22023',
  null,
  'origin and destination stations must differ'
);
select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002309',
      '00000000-0000-0000-0000-000000002202',
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  '22023',
  null,
  'the supplied origin must match the battery current station'
);
select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002309',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002203'
    )
  $$,
  '23514',
  null,
  'relocation rejects a full destination station'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000002101',
  true
);
select throws_ok(
  $$
    select public.admin_register_battery(
      '00000000-0000-0000-0000-000000002360',
      'FORBIDDEN',
      10000,
      500,
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  '42501',
  null,
  'a normal user cannot register a battery'
);
select throws_ok(
  $$
    select public.admin_relocate_battery(
      '00000000-0000-0000-0000-000000002309',
      '00000000-0000-0000-0000-000000002201',
      '00000000-0000-0000-0000-000000002202'
    )
  $$,
  '42501',
  null,
  'a normal user cannot relocate a battery'
);
select throws_ok(
  $$select * from public.admin_list_batteries()$$,
  '42501',
  null,
  'a normal user cannot use the administrator battery listing'
);
select throws_ok(
  $$
    insert into public.batteries (
      battery_id,
      model_name,
      capacity,
      cycle_life,
      station_id
    )
    values (
      '00000000-0000-0000-0000-000000002361',
      'DIRECT-INSERT',
      10000,
      500,
      '00000000-0000-0000-0000-000000002201'
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot bypass registration with direct insert'
);

reset role;

select ok(
  position(
    'LOCK_STATION_CAPACITY(P_STATION_ID, NULL, 1)'
    in upper(
      pg_get_functiondef(
        'private.admin_register_battery(uuid,text,integer,integer,uuid)'::regprocedure
      )
    )
  ) > 0,
  'registration reserves capacity under the shared station row lock'
);
select ok(
  position(
    'FOR UPDATE'
    in upper(
      pg_get_functiondef(
        'private.admin_relocate_battery(uuid,uuid,uuid)'::regprocedure
      )
    )
  ) > 0,
  'relocation locks the battery before changing its station'
);
select ok(
  position(
    'P_ORIGIN_STATION_ID < P_DESTINATION_STATION_ID'
    in upper(
      pg_get_functiondef(
        'private.admin_relocate_battery(uuid,uuid,uuid)'::regprocedure
      )
    )
  ) > 0,
  'relocation acquires station locks in stable UUID order'
);
select ok(
  position(
    'LOCK_STATION_CAPACITY(P_DESTINATION_STATION_ID, NULL, 1)'
    in upper(
      pg_get_functiondef(
        'private.admin_relocate_battery(uuid,uuid,uuid)'::regprocedure
      )
    )
  ) > 0,
  'relocation reserves destination capacity through the shared guard'
);
select ok(
  not has_table_privilege('authenticated', 'public.batteries', 'INSERT')
  and not has_table_privilege('authenticated', 'public.batteries', 'UPDATE'),
  'authenticated clients cannot bypass atomic battery RPCs'
);

select * from finish();
rollback;

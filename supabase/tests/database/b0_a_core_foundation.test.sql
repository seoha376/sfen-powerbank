begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select has_table('public', 'app_users', 'app_users exists');
select has_table('public', 'stations', 'stations exists');
select has_table('public', 'batteries', 'batteries exists');
select has_table('public', 'rentals', 'rentals exists');
select has_table('public', 'battery_status_history', 'battery_status_history exists');
select has_table('public', 'system_settings', 'system_settings exists');

select is(
  (
    select count(*)::integer
    from pg_class as tables
    join pg_namespace as schemas on schemas.oid = tables.relnamespace
    where schemas.nspname = 'public'
      and tables.relname in (
        'app_users',
        'stations',
        'batteries',
        'rentals',
        'battery_status_history',
        'system_settings'
      )
      and tables.relrowsecurity
  ),
  6,
  'RLS is enabled on all B0-A tables'
);

select is(
  (select count(*)::integer from public.system_settings),
  1,
  'system_settings contains one row'
);
select is(
  (select rental_period_days from public.system_settings where settings_id = 1),
  7,
  'rental_period_days defaults to 7'
);
select is(
  (select long_term_days from public.system_settings where settings_id = 1),
  60,
  'long_term_days defaults to 60'
);
select is(
  (select time_scale from public.system_settings where settings_id = 1),
  1::numeric,
  'time_scale defaults to 1'
);
select is(
  (select battery_unit_price from public.system_settings where settings_id = 1),
  30000,
  'battery_unit_price defaults to 30000'
);

select lives_ok(
  $$
    insert into public.app_users (user_id, user_name, role)
    values ('20260001', 'Test Student', 'user')
  $$,
  'an eight-digit user login ID is accepted'
);
select lives_ok(
  $$
    insert into public.app_users (user_id, user_name, role)
    values ('admin-root', 'Test Administrator', 'administrator')
  $$,
  'a separate administrator ID format is accepted'
);
select throws_ok(
  $$
    insert into public.app_users (user_id, user_name, role)
    values ('student-1', 'Invalid Student', 'user')
  $$,
  '23514',
  null,
  'a non-eight-digit user login ID is rejected'
);
select throws_ok(
  $$
    insert into public.app_users (user_id, user_name, role)
    values ('20260002', 'Invalid Role', 'manager')
  $$,
  '23514',
  null,
  'an unknown role is rejected'
);
select throws_ok(
  $$
    insert into public.app_users (user_id, user_name, role, user_status)
    values ('20260003', 'Invalid Status', 'user', 'Leave')
  $$,
  '23514',
  null,
  'an unknown user status is rejected'
);
select throws_ok(
  $$
    insert into public.app_users (user_id, user_name, role, approval_status)
    values ('20260004', 'Invalid Approval', 'user', 'Unknown')
  $$,
  '23514',
  null,
  'an unknown approval status is rejected'
);
select throws_ok(
  $$
    insert into public.app_users (user_id, user_name, role, suspension_type)
    values ('20260005', 'Invalid Suspension', 'user', 'indefinite')
  $$,
  '23514',
  null,
  'an unknown suspension type is rejected'
);

select lives_ok(
  $$
    insert into public.stations (
      station_id,
      station_name,
      location,
      slot_capacity
    ) values (
      '00000000-0000-0000-0000-000000000101',
      'Engineering Hall',
      'First floor',
      10
    )
  $$,
  'a valid station is accepted'
);
select throws_ok(
  $$
    insert into public.stations (station_name, location, slot_capacity)
    values ('Invalid Station', 'Nowhere', -1)
  $$,
  '23514',
  null,
  'negative slot capacity is rejected'
);

select lives_ok(
  $$
    insert into public.batteries (
      battery_id,
      model_name,
      capacity,
      cycle_life,
      station_id,
      status,
      current_charge
    ) values (
      '00000000-0000-0000-0000-000000000201',
      'SFEN-10K',
      10000,
      500,
      '00000000-0000-0000-0000-000000000101',
      'Available',
      100
    )
  $$,
  'a valid battery is accepted'
);
select throws_ok(
  $$
    insert into public.batteries (model_name, capacity, cycle_life, status, current_charge)
    values ('Invalid Capacity', 0, 500, 'Charging', 50)
  $$,
  '23514',
  null,
  'zero battery capacity is rejected'
);
select throws_ok(
  $$
    insert into public.batteries (model_name, capacity, cycle_life, status, current_charge)
    values ('Invalid Cycle', 10000, 0, 'Charging', 50)
  $$,
  '23514',
  null,
  'cycle_life below one is rejected'
);
select throws_ok(
  $$
    insert into public.batteries (
      model_name,
      capacity,
      cycle_life,
      used_count,
      status,
      current_charge
    ) values ('Invalid Usage', 10000, 500, -1, 'Charging', 50)
  $$,
  '23514',
  null,
  'negative used_count is rejected'
);
select throws_ok(
  $$
    insert into public.batteries (model_name, capacity, cycle_life, status, current_charge)
    values ('Invalid Charge', 10000, 500, 'Charging', 101)
  $$,
  '23514',
  null,
  'charge above 100 is rejected'
);
select throws_ok(
  $$
    insert into public.batteries (model_name, capacity, cycle_life, status, current_charge)
    values ('Invalid Status', 10000, 500, 'Retired', 50)
  $$,
  '23514',
  null,
  'an unknown battery status is rejected'
);
select throws_ok(
  $$
    insert into public.batteries (
      model_name,
      capacity,
      cycle_life,
      station_id,
      status,
      current_charge
    ) values (
      'Missing Station',
      10000,
      500,
      '00000000-0000-0000-0000-000000009999',
      'Available',
      100
    )
  $$,
  '23503',
  null,
  'an unknown station foreign key is rejected'
);

select lives_ok(
  $$
    insert into public.rentals (
      rental_id,
      user_id,
      battery_id,
      rental_station_id,
      rental_time,
      compensation_multiplier
    ) values (
      '00000000-0000-0000-0000-000000000301',
      '20260001',
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000101',
      '2026-11-08T10:00:00Z',
      0
    )
  $$,
  'a valid active rental is accepted'
);
select throws_ok(
  $$
    insert into public.rentals (
      user_id,
      battery_id,
      rental_station_id,
      rental_time,
      return_time
    ) values (
      '20260001',
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000101',
      '2026-11-08T10:00:00Z',
      '2026-11-08T09:59:59Z'
    )
  $$,
  '23514',
  null,
  'a return before rental time is rejected'
);
select throws_ok(
  $$
    insert into public.rentals (
      user_id,
      battery_id,
      rental_station_id,
      compensation_multiplier
    ) values (
      '20260001',
      '00000000-0000-0000-0000-000000000201',
      '00000000-0000-0000-0000-000000000101',
      2
    )
  $$,
  '23514',
  null,
  'an unsupported compensation multiplier is rejected'
);

select lives_ok(
  $$
    insert into public.battery_status_history (
      battery_id,
      from_status,
      to_status,
      changed_by,
      station_id,
      reason
    ) values (
      '00000000-0000-0000-0000-000000000201',
      null,
      'Charging',
      'admin-root',
      '00000000-0000-0000-0000-000000000101',
      'Initial registration'
    )
  $$,
  'initial history allows a null source status leading to Charging'
);
select throws_ok(
  $$
    insert into public.battery_status_history (
      battery_id,
      from_status,
      to_status
    ) values (
      '00000000-0000-0000-0000-000000000201',
      null,
      'Available'
    )
  $$,
  '23514',
  null,
  'initial history cannot skip Charging'
);

select throws_ok(
  $$
    insert into public.system_settings (
      settings_id,
      rental_period_days,
      long_term_days,
      time_scale,
      battery_unit_price
    ) values (2, 7, 60, 1, 30000)
  $$,
  '23514',
  null,
  'a second settings identifier is rejected'
);
select throws_ok(
  $$
    update public.system_settings
    set rental_period_days = 0
    where settings_id = 1
  $$,
  '23514',
  null,
  'non-positive rental period is rejected'
);
select throws_ok(
  $$
    update public.system_settings
    set long_term_days = rental_period_days
    where settings_id = 1
  $$,
  '23514',
  null,
  'long-term period must exceed the rental period'
);
select throws_ok(
  $$
    update public.system_settings
    set time_scale = 0
    where settings_id = 1
  $$,
  '23514',
  null,
  'non-positive time scale is rejected'
);
select throws_ok(
  $$
    update public.system_settings
    set battery_unit_price = 0
    where settings_id = 1
  $$,
  '23514',
  null,
  'non-positive battery unit price is rejected'
);

select * from finish();
rollback;

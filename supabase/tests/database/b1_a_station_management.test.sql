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
    '00000000-0000-0000-0000-000000001101',
    'authenticated',
    'authenticated',
    '20261101@students.sfen.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000001199',
    'authenticated',
    'authenticated',
    'b1a-admin@example.com',
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
    '20261101',
    '00000000-0000-0000-0000-000000001101',
    'Station Test User',
    'user',
    'Approved',
    true
  ),
  (
    'b1a-admin',
    '00000000-0000-0000-0000-000000001199',
    'Station Test Administrator',
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
  '00000000-0000-0000-0000-000000001201',
  'Original Station',
  'Engineering Hall',
  5
);

insert into public.batteries (
  battery_id,
  model_name,
  capacity,
  cycle_life,
  status,
  station_id,
  current_charge
)
values
  (
    '00000000-0000-0000-0000-000000001301',
    'B1A-CHARGING',
    10000,
    500,
    'Charging',
    '00000000-0000-0000-0000-000000001201',
    20
  ),
  (
    '00000000-0000-0000-0000-000000001302',
    'B1A-AVAILABLE',
    10000,
    500,
    'Available',
    '00000000-0000-0000-0000-000000001201',
    100
  ),
  (
    '00000000-0000-0000-0000-000000001303',
    'B1A-REPAIR',
    10000,
    500,
    'UnderRepair',
    '00000000-0000-0000-0000-000000001201',
    40
  ),
  (
    '00000000-0000-0000-0000-000000001304',
    'B1A-RENTED',
    10000,
    500,
    'Rented',
    '00000000-0000-0000-0000-000000001201',
    70
  );

select is(
  (
    select occupied_slot_count
    from public.station_inventory
    where station_id = '00000000-0000-0000-0000-000000001201'
  ),
  3,
  'Charging, Available, and UnderRepair batteries occupy station slots'
);
select is(
  (
    select available_count
    from public.station_inventory
    where station_id = '00000000-0000-0000-0000-000000001201'
  ),
  1,
  'available inventory is distinct from occupied slot count'
);
select is(
  (
    select remaining_slot_count
    from public.station_inventory
    where station_id = '00000000-0000-0000-0000-000000001201'
  ),
  2,
  'remaining station slots are derived from capacity and current occupancy'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000001199',
  true
);

select lives_ok(
  $$
    select public.admin_create_station(
      'Library Station',
      'Library first floor',
      6
    )
  $$,
  'an administrator can create a station through the transaction RPC'
);
select is(
  (
    select count(*)::integer
    from public.station_inventory
    where station_name = 'Library Station'
      and location = 'Library first floor'
      and slot_capacity = 6
      and occupied_slot_count = 0
      and remaining_slot_count = 6
  ),
  1,
  'station creation returns a station represented by the computed overview'
);
select throws_ok(
  $$select public.admin_create_station('', 'Library', 3)$$,
  '22023',
  null,
  'station creation rejects a missing name'
);
select throws_ok(
  $$select public.admin_create_station('Invalid', null, 3)$$,
  '22023',
  null,
  'station creation rejects a missing location'
);
select throws_ok(
  $$select public.admin_create_station('Invalid', 'Library', -1)$$,
  '22023',
  null,
  'station creation rejects a negative slot capacity'
);
select lives_ok(
  $$
    select public.admin_update_station(
      '00000000-0000-0000-0000-000000001201',
      'Updated Station',
      'Science Hall',
      4
    )
  $$,
  'an administrator can update station details without violating occupancy'
);
select results_eq(
  $$
    select station_name, location, slot_capacity, remaining_slot_count
    from public.station_inventory
    where station_id = '00000000-0000-0000-0000-000000001201'
  $$,
  $$values ('Updated Station'::text, 'Science Hall'::text, 4, 1)$$,
  'station details and remaining slots reflect the committed update'
);
select throws_ok(
  $$
    select public.admin_update_station(
      '00000000-0000-0000-0000-000000001201',
      'Too Small',
      'Science Hall',
      2
    )
  $$,
  '23514',
  null,
  'station capacity cannot be reduced below current occupancy'
);
select throws_ok(
  $$
    update public.stations
    set slot_capacity = 1
    where station_id = '00000000-0000-0000-0000-000000001201'
  $$,
  '42501',
  null,
  'even an administrator cannot bypass the capacity RPC with direct update'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000001101',
  true
);
select throws_ok(
  $$select public.admin_create_station('Forbidden', 'Nowhere', 1)$$,
  '42501',
  null,
  'a normal user cannot create a station'
);
select throws_ok(
  $$
    select public.admin_update_station(
      '00000000-0000-0000-0000-000000001201',
      'Forbidden',
      'Nowhere',
      5
    )
  $$,
  '42501',
  null,
  'a normal user cannot update a station'
);
select throws_ok(
  $$
    insert into public.stations (station_name, location, slot_capacity)
    values ('Direct Insert', 'Nowhere', 1)
  $$,
  '42501',
  null,
  'authenticated clients cannot bypass the station creation RPC'
);

reset role;

select ok(
  position(
    'FOR UPDATE'
    in upper(
      pg_get_functiondef(
        'private.lock_station_capacity(uuid,integer,integer)'::regprocedure
      )
    )
  ) > 0,
  'the shared capacity guard serializes station occupancy checks with a row lock'
);
select ok(
  position(
    'LOCK_STATION_CAPACITY'
    in upper(
      pg_get_functiondef(
        'private.admin_update_station(uuid,text,text,integer)'::regprocedure
      )
    )
  ) > 0,
  'station updates reuse the shared capacity lock contract'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.lock_station_capacity(uuid,integer,integer)',
    'EXECUTE'
  ),
  'clients cannot invoke the internal station lock directly'
);

select * from finish();
rollback;

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
    '00000000-0000-0000-0000-000000000401',
    'authenticated',
    'authenticated',
    '20260001@students.sfen.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    'authenticated',
    'authenticated',
    '20260002@students.sfen.invalid',
    extensions.crypt('test-password', extensions.gen_salt('bf')),
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000499',
    'authenticated',
    'authenticated',
    'admin@example.com',
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
    '20260001',
    '00000000-0000-0000-0000-000000000401',
    'Student One',
    'user',
    'Approved',
    true
  ),
  (
    '20260002',
    '00000000-0000-0000-0000-000000000402',
    'Student Two',
    'user',
    'Approved',
    true
  ),
  (
    'admin-root',
    '00000000-0000-0000-0000-000000000499',
    'Administrator',
    'administrator',
    null,
    true
  );

select lives_ok(
  $$
    insert into public.app_users (
      user_id,
      auth_user_id,
      user_name,
      role
    ) values (
      '20260003',
      null,
      'Unlinked Student',
      'user'
    )
  $$,
  'an app user may exist before trusted Auth provisioning'
);

select throws_ok(
  $$
    update public.app_users
    set auth_user_id = '00000000-0000-0000-0000-000000009999'
    where user_id = '20260003'
  $$,
  '23503',
  null,
  'app_users.auth_user_id must reference auth.users.id'
);

insert into public.stations (
  station_id,
  station_name,
  location,
  slot_capacity
)
values (
  '00000000-0000-0000-0000-000000000501',
  'Engineering Hall',
  'First floor',
  4
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
    '00000000-0000-0000-0000-000000000601',
    'SFEN-10K',
    10000,
    500,
    'Available',
    '00000000-0000-0000-0000-000000000501',
    100
  ),
  (
    '00000000-0000-0000-0000-000000000602',
    'SFEN-10K',
    10000,
    500,
    'Charging',
    '00000000-0000-0000-0000-000000000501',
    50
  );

insert into public.rentals (
  rental_id,
  user_id,
  battery_id,
  rental_station_id,
  rental_time
)
values
  (
    '00000000-0000-0000-0000-000000000701',
    '20260001',
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000501',
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000702',
    '20260002',
    '00000000-0000-0000-0000-000000000602',
    '00000000-0000-0000-0000-000000000501',
    now()
  );

insert into public.battery_status_history (
  battery_id,
  from_status,
  to_status,
  changed_by,
  station_id,
  rental_id
)
values (
  '00000000-0000-0000-0000-000000000601',
  'Available',
  'Rented',
  'admin-root',
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000701'
);

select is(
  (select public from storage.buckets where id = 'enrollment-certificates'),
  false,
  'the enrollment certificate bucket is private'
);
select is(
  (
    select file_size_limit
    from storage.buckets
    where id = 'enrollment-certificates'
  ),
  5242880::bigint,
  'the enrollment certificate bucket limit is 5 MiB'
);
select is(
  (
    select allowed_mime_types
    from storage.buckets
    where id = 'enrollment-certificates'
  ),
  array['application/pdf', 'image/jpeg', 'image/png']::text[],
  'the enrollment certificate bucket accepts only PDF, JPG, and PNG'
);

set local role anon;

select is(
  (select available_count from public.station_inventory),
  1,
  'anonymous clients can use the limited station inventory contract'
);
select throws_ok(
  $$select model_name from public.batteries$$,
  '42501',
  null,
  'anonymous clients cannot read non-contract battery columns'
);
select throws_ok(
  $$select * from public.app_users$$,
  '42501',
  null,
  'anonymous clients cannot read app users'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000401',
  true
);

select is(
  (select count(*)::integer from public.app_users),
  1,
  'a user reads only their own app user row'
);
select is(
  (select count(*)::integer from public.rentals),
  1,
  'a user reads only their own rentals'
);
select results_eq(
  $$
    with changed as (
      update public.app_users
      set role = 'administrator', eligibility_status = true
      where user_id = '20260001'
      returning 1
    )
    select count(*)::integer from changed
  $$,
  array[0],
  'a user cannot grant themselves administrator or eligibility values'
);
select throws_ok(
  $$
    update public.batteries
    set status = 'Disposed'
    where battery_id = '00000000-0000-0000-0000-000000000601'
  $$,
  '42501',
  null,
  'a user cannot modify batteries'
);
select is(
  (select count(*)::integer from public.battery_status_history),
  0,
  'a user cannot read battery status history'
);
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'enrollment-certificates',
      '00000000-0000-0000-0000-000000000401/certificate.pdf',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  'a user can create certificate metadata in their own Auth folder'
);
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'enrollment-certificates',
      '00000000-0000-0000-0000-000000000402/stolen.pdf',
      '00000000-0000-0000-0000-000000000401'
    )
  $$,
  '42501',
  null,
  'a user cannot upload through another user folder path'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000402',
  true
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'enrollment-certificates'
  ),
  0,
  'another user cannot read certificate objects they do not own'
);
select results_eq(
  $$
    with changed as (
      update storage.objects
      set name = '00000000-0000-0000-0000-000000000402/tampered.pdf'
      where bucket_id = 'enrollment-certificates'
        and name = '00000000-0000-0000-0000-000000000401/certificate.pdf'
      returning 1
    )
    select count(*)::integer from changed
  $$,
  array[0],
  'another user cannot update a certificate object they do not own'
);
select ok(
  coalesce(
    (
      select
        policy.cmd = 'DELETE'
        and policy.roles = array['authenticated']::name[]
        and position('enrollment-certificates' in policy.qual) > 0
        and position('owner_id' in policy.qual) > 0
        and position('foldername' in policy.qual) > 0
        and position('auth.uid' in policy.qual) > 0
        and position('private.is_admin' in policy.qual) > 0
      from pg_catalog.pg_policies as policy
      where policy.schemaname = 'storage'
        and policy.tablename = 'objects'
        and policy.policyname =
          'users and administrators delete enrollment certificates'
    ),
    false
  ),
  'certificate deletion policy requires an authenticated owner path or administrator'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000499',
  true
);
select ok((select private.is_admin()), 'the linked administrator is recognized');
select is(
  (select count(*)::integer from public.app_users),
  4,
  'an administrator can read all app users'
);
select is(
  (select count(*)::integer from public.rentals),
  2,
  'an administrator can read all rentals'
);
select results_eq(
  $$
    with changed as (
      update public.app_users
      set user_name = user_name
      where user_id = '20260001'
      returning 1
    )
    select count(*)::integer from changed
  $$,
  array[1],
  'an administrator passes the database-level app user write check'
);
select is(
  (
    select count(*)::integer
    from storage.objects
    where bucket_id = 'enrollment-certificates'
  ),
  1,
  'an administrator can read enrollment certificates'
);

reset role;

select * from finish();
rollback;

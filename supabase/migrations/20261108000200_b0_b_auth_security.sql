alter table public.app_users
  add constraint app_users_auth_user_id_fkey
  foreign key (auth_user_id)
  references auth.users (id)
  on delete set null;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select app_user.user_id
  from public.app_users as app_user
  where app_user.auth_user_id = (select auth.uid())
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users as app_user
    where app_user.auth_user_id = (select auth.uid())
      and app_user.role = 'administrator'
  )
$$;

revoke execute on function private.current_app_user_id() from public, anon;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.current_app_user_id() to authenticated;
grant execute on function private.is_admin() to authenticated;

alter table public.app_users enable row level security;
alter table public.stations enable row level security;
alter table public.batteries enable row level security;
alter table public.rentals enable row level security;
alter table public.battery_status_history enable row level security;
alter table public.system_settings enable row level security;

revoke all on table public.app_users from anon, authenticated;
revoke all on table public.stations from anon, authenticated;
revoke all on table public.batteries from anon, authenticated;
revoke all on table public.rentals from anon, authenticated;
revoke all on table public.battery_status_history from anon, authenticated;
revoke all on table public.system_settings from anon, authenticated;

grant select on table public.app_users to authenticated;
grant select on table public.rentals to authenticated;
grant select on table public.battery_status_history to authenticated;
grant select on table public.system_settings to authenticated;
grant select (station_id, station_name, location, slot_capacity)
  on table public.stations to anon, authenticated;
grant select (battery_id, station_id, status)
  on table public.batteries to anon, authenticated;

grant insert, update, delete on table public.app_users to authenticated;
grant insert, update, delete on table public.stations to authenticated;
grant insert, update, delete on table public.batteries to authenticated;
grant insert, update, delete on table public.rentals to authenticated;
grant insert, update, delete on table public.battery_status_history to authenticated;
grant insert, update, delete on table public.system_settings to authenticated;

create policy "app users read self or administrator"
on public.app_users
for select
to authenticated
using (
  auth_user_id = (select auth.uid())
  or (select private.is_admin())
);

create policy "administrators manage app users"
on public.app_users
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "public reads station inventory fields"
on public.stations
for select
to anon, authenticated
using (true);

create policy "administrators manage stations"
on public.stations
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "public reads battery inventory fields"
on public.batteries
for select
to anon, authenticated
using (true);

create policy "administrators manage batteries"
on public.batteries
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "users read own rentals and administrators read all rentals"
on public.rentals
for select
to authenticated
using (
  user_id = (select private.current_app_user_id())
  or (select private.is_admin())
);

create policy "administrators manage rentals"
on public.rentals
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "administrators read battery history"
on public.battery_status_history
for select
to authenticated
using ((select private.is_admin()));

create policy "administrators manage battery history"
on public.battery_status_history
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "authenticated users read system settings"
on public.system_settings
for select
to authenticated
using (true);

create policy "administrators manage system settings"
on public.system_settings
for all
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create or replace view public.station_inventory
with (security_invoker = true)
as
select
  station.station_id,
  station.station_name,
  station.location,
  station.slot_capacity,
  count(*) filter (where battery.status = 'Available')::integer as available_count,
  count(*) filter (
    where battery.status in ('Charging', 'Available', 'UnderRepair')
  )::integer as occupied_slot_count
from public.stations as station
left join public.batteries as battery
  on battery.station_id = station.station_id
group by
  station.station_id,
  station.station_name,
  station.location,
  station.slot_capacity;

revoke all on table public.station_inventory from public;
grant select on table public.station_inventory to anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'enrollment-certificates',
  'enrollment-certificates',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users and administrators read enrollment certificates"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'enrollment-certificates'
  and (
    (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or (select private.is_admin())
  )
);

create policy "users upload enrollment certificates to own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'enrollment-certificates'
  and (
    (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or (select private.is_admin())
  )
);

create policy "users and administrators update enrollment certificates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'enrollment-certificates'
  and (
    (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or (select private.is_admin())
  )
)
with check (
  bucket_id = 'enrollment-certificates'
  and (
    (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or (select private.is_admin())
  )
);

create policy "users and administrators delete enrollment certificates"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'enrollment-certificates'
  and (
    (
      owner_id = (select auth.uid())::text
      and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    or (select private.is_admin())
  )
);

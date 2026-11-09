create or replace view public.station_inventory
with (security_invoker = true)
as
select
  station.station_id,
  station.station_name,
  station.location,
  station.slot_capacity,
  count(*) filter (where battery.status = 'Available')::integer
    as available_count,
  count(*) filter (
    where battery.status in ('Charging', 'Available', 'UnderRepair')
  )::integer as occupied_slot_count,
  greatest(
    station.slot_capacity - count(*) filter (
      where battery.status in ('Charging', 'Available', 'UnderRepair')
    )::integer,
    0
  ) as remaining_slot_count
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

create or replace function private.lock_station_capacity(
  p_station_id uuid,
  p_capacity_override integer default null,
  p_occupancy_delta integer default 0
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_capacity integer;
  occupied_count integer;
  effective_capacity integer;
  projected_occupancy integer;
begin
  if p_station_id is null then
    raise exception 'station_id is required'
      using errcode = '22023';
  end if;

  if p_occupancy_delta is null then
    raise exception 'occupancy_delta is required'
      using errcode = '22023';
  end if;

  select station.slot_capacity
  into current_capacity
  from public.stations as station
  where station.station_id = p_station_id
  for update;

  if not found then
    raise exception 'station does not exist'
      using errcode = 'P0002';
  end if;

  effective_capacity := coalesce(p_capacity_override, current_capacity);
  if effective_capacity < 0 then
    raise exception 'slot_capacity must be zero or greater'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into occupied_count
  from public.batteries as battery
  where battery.station_id = p_station_id
    and battery.status in ('Charging', 'Available', 'UnderRepair');

  projected_occupancy := occupied_count + p_occupancy_delta;
  if projected_occupancy < 0 then
    raise exception 'projected station occupancy cannot be negative'
      using errcode = '22023';
  end if;

  if projected_occupancy > effective_capacity then
    raise exception 'station capacity would be exceeded'
      using errcode = '23514';
  end if;

  return occupied_count;
end;
$$;

create or replace function private.admin_create_station(
  p_station_name text,
  p_location text,
  p_slot_capacity integer
)
returns table (
  station_id uuid,
  station_name text,
  location text,
  slot_capacity integer,
  available_count integer,
  occupied_slot_count integer,
  remaining_slot_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_station_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'administrator access is required'
      using errcode = '42501';
  end if;

  if p_station_name is null or btrim(p_station_name) = '' then
    raise exception 'station_name is required'
      using errcode = '22023';
  end if;

  if p_location is null or btrim(p_location) = '' then
    raise exception 'location is required'
      using errcode = '22023';
  end if;

  if p_slot_capacity is null or p_slot_capacity < 0 then
    raise exception 'slot_capacity must be zero or greater'
      using errcode = '22023';
  end if;

  insert into public.stations (station_name, location, slot_capacity)
  values (btrim(p_station_name), btrim(p_location), p_slot_capacity)
  returning stations.station_id into created_station_id;

  return query
  select inventory.*
  from public.station_inventory as inventory
  where inventory.station_id = created_station_id;
end;
$$;

create or replace function private.admin_update_station(
  p_station_id uuid,
  p_station_name text,
  p_location text,
  p_slot_capacity integer
)
returns table (
  station_id uuid,
  station_name text,
  location text,
  slot_capacity integer,
  available_count integer,
  occupied_slot_count integer,
  remaining_slot_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'administrator access is required'
      using errcode = '42501';
  end if;

  if p_station_name is null or btrim(p_station_name) = '' then
    raise exception 'station_name is required'
      using errcode = '22023';
  end if;

  if p_location is null or btrim(p_location) = '' then
    raise exception 'location is required'
      using errcode = '22023';
  end if;

  if p_slot_capacity is null or p_slot_capacity < 0 then
    raise exception 'slot_capacity must be zero or greater'
      using errcode = '22023';
  end if;

  perform private.lock_station_capacity(
    p_station_id,
    p_slot_capacity,
    0
  );

  update public.stations as station
  set
    station_name = btrim(p_station_name),
    location = btrim(p_location),
    slot_capacity = p_slot_capacity
  where station.station_id = p_station_id;

  return query
  select inventory.*
  from public.station_inventory as inventory
  where inventory.station_id = p_station_id;
end;
$$;

create or replace function public.admin_create_station(
  p_station_name text,
  p_location text,
  p_slot_capacity integer
)
returns table (
  station_id uuid,
  station_name text,
  location text,
  slot_capacity integer,
  available_count integer,
  occupied_slot_count integer,
  remaining_slot_count integer
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.admin_create_station(
    p_station_name,
    p_location,
    p_slot_capacity
  )
$$;

create or replace function public.admin_update_station(
  p_station_id uuid,
  p_station_name text,
  p_location text,
  p_slot_capacity integer
)
returns table (
  station_id uuid,
  station_name text,
  location text,
  slot_capacity integer,
  available_count integer,
  occupied_slot_count integer,
  remaining_slot_count integer
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.admin_update_station(
    p_station_id,
    p_station_name,
    p_location,
    p_slot_capacity
  )
$$;

revoke insert, update on table public.stations from authenticated;

revoke execute on function private.lock_station_capacity(uuid, integer, integer)
  from public, anon, authenticated;
revoke execute on function private.admin_create_station(text, text, integer)
  from public, anon;
revoke execute on function private.admin_update_station(uuid, text, text, integer)
  from public, anon;
grant execute on function private.admin_create_station(text, text, integer)
  to authenticated;
grant execute on function private.admin_update_station(uuid, text, text, integer)
  to authenticated;

revoke execute on function public.admin_create_station(text, text, integer)
  from public, anon;
revoke execute on function public.admin_update_station(uuid, text, text, integer)
  from public, anon;
grant execute on function public.admin_create_station(text, text, integer)
  to authenticated;
grant execute on function public.admin_update_station(uuid, text, text, integer)
  to authenticated;

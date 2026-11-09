create or replace function private.admin_register_battery(
  p_battery_id uuid,
  p_model_name text,
  p_capacity integer,
  p_cycle_life integer,
  p_station_id uuid
)
returns table (
  battery_id uuid,
  model_name text,
  capacity integer,
  cycle_life integer,
  used_count integer,
  status text,
  station_id uuid,
  current_charge integer,
  charge_started_at timestamptz,
  disposal_confirmed_at timestamptz,
  history_id uuid,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id text;
  event_at timestamptz;
  created_history_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'administrator access is required'
      using errcode = '42501';
  end if;

  actor_user_id := private.current_app_user_id();
  if actor_user_id is null then
    raise exception 'administrator profile is required'
      using errcode = '42501';
  end if;

  if p_battery_id is null then
    raise exception 'battery_id is required'
      using errcode = '22023';
  end if;

  if p_model_name is null or btrim(p_model_name) = '' then
    raise exception 'model_name is required'
      using errcode = '22023';
  end if;

  if p_capacity is null or p_capacity <= 0 then
    raise exception 'capacity must be a positive integer'
      using errcode = '22023';
  end if;

  if p_cycle_life is null or p_cycle_life < 1 then
    raise exception 'cycle_life must be at least one'
      using errcode = '22023';
  end if;

  perform private.lock_station_capacity(p_station_id, null, 1);
  event_at := clock_timestamp();

  insert into public.batteries (
    battery_id,
    model_name,
    capacity,
    cycle_life,
    used_count,
    status,
    station_id,
    current_charge,
    charge_started_at,
    disposal_confirmed_at
  )
  values (
    p_battery_id,
    btrim(p_model_name),
    p_capacity,
    p_cycle_life,
    0,
    'Charging',
    p_station_id,
    0,
    event_at,
    null
  );

  insert into public.battery_status_history (
    battery_id,
    from_status,
    to_status,
    changed_at,
    changed_by,
    station_id,
    reason
  )
  values (
    p_battery_id,
    null,
    'Charging',
    event_at,
    actor_user_id,
    p_station_id,
    'Registration'
  )
  returning battery_status_history.history_id into created_history_id;

  return query
  select
    battery.battery_id,
    battery.model_name,
    battery.capacity,
    battery.cycle_life,
    battery.used_count,
    battery.status,
    battery.station_id,
    battery.current_charge,
    battery.charge_started_at,
    battery.disposal_confirmed_at,
    created_history_id,
    event_at
  from public.batteries as battery
  where battery.battery_id = p_battery_id;
end;
$$;

create or replace function private.admin_relocate_battery(
  p_battery_id uuid,
  p_origin_station_id uuid,
  p_destination_station_id uuid
)
returns table (
  battery_id uuid,
  origin_station_id uuid,
  destination_station_id uuid,
  status text,
  charge_started_at timestamptz,
  history_id uuid,
  changed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_user_id text;
  current_station_id uuid;
  current_status text;
  current_charge_started_at timestamptz;
  event_at timestamptz;
  created_history_id uuid;
begin
  if not (select private.is_admin()) then
    raise exception 'administrator access is required'
      using errcode = '42501';
  end if;

  actor_user_id := private.current_app_user_id();
  if actor_user_id is null then
    raise exception 'administrator profile is required'
      using errcode = '42501';
  end if;

  if p_battery_id is null
    or p_origin_station_id is null
    or p_destination_station_id is null
  then
    raise exception 'battery, origin station, and destination station are required'
      using errcode = '22023';
  end if;

  if p_origin_station_id = p_destination_station_id then
    raise exception 'origin and destination stations must be different'
      using errcode = '22023';
  end if;

  select
    battery.station_id,
    battery.status,
    battery.charge_started_at
  into
    current_station_id,
    current_status,
    current_charge_started_at
  from public.batteries as battery
  where battery.battery_id = p_battery_id
  for update;

  if not found then
    raise exception 'battery does not exist'
      using errcode = 'P0002';
  end if;

  if current_station_id is distinct from p_origin_station_id then
    raise exception 'battery is not located at the supplied origin station'
      using errcode = '22023';
  end if;

  if current_status not in ('Charging', 'Available', 'UnderRepair') then
    raise exception 'battery status does not allow relocation'
      using errcode = '23514';
  end if;

  if p_origin_station_id < p_destination_station_id then
    perform private.lock_station_capacity(p_origin_station_id, null, 0);
    perform private.lock_station_capacity(p_destination_station_id, null, 1);
  else
    perform private.lock_station_capacity(p_destination_station_id, null, 1);
    perform private.lock_station_capacity(p_origin_station_id, null, 0);
  end if;

  event_at := clock_timestamp();

  update public.batteries as battery
  set station_id = p_destination_station_id
  where battery.battery_id = p_battery_id;

  insert into public.battery_status_history (
    battery_id,
    from_status,
    to_status,
    changed_at,
    changed_by,
    station_id,
    reason
  )
  values (
    p_battery_id,
    current_status,
    current_status,
    event_at,
    actor_user_id,
    p_destination_station_id,
    'Relocation'
  )
  returning battery_status_history.history_id into created_history_id;

  return query
  select
    p_battery_id,
    p_origin_station_id,
    p_destination_station_id,
    current_status,
    current_charge_started_at,
    created_history_id,
    event_at;
end;
$$;

create or replace function private.admin_list_batteries()
returns table (
  battery_id uuid,
  model_name text,
  capacity integer,
  cycle_life integer,
  used_count integer,
  status text,
  station_id uuid,
  station_name text,
  current_charge integer,
  charge_started_at timestamptz,
  disposal_confirmed_at timestamptz,
  charge_simulation_elapsed_seconds numeric,
  charge_time_anchor_at timestamptz,
  charge_time_scale numeric,
  can_relocate boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.is_admin()) then
    raise exception 'administrator access is required'
      using errcode = '42501';
  end if;

  return query
  select
    battery.battery_id,
    battery.model_name,
    battery.capacity,
    battery.cycle_life,
    battery.used_count,
    battery.status,
    battery.station_id,
    station.station_name,
    battery.current_charge,
    battery.charge_started_at,
    battery.disposal_confirmed_at,
    battery.charge_simulation_elapsed_seconds,
    battery.charge_time_anchor_at,
    battery.charge_time_scale,
    battery.status in ('Charging', 'Available', 'UnderRepair')
  from public.batteries as battery
  left join public.stations as station
    on station.station_id = battery.station_id
  order by station.station_name nulls last, battery.battery_id;
end;
$$;

create or replace function public.admin_register_battery(
  p_battery_id uuid,
  p_model_name text,
  p_capacity integer,
  p_cycle_life integer,
  p_station_id uuid
)
returns table (
  battery_id uuid,
  model_name text,
  capacity integer,
  cycle_life integer,
  used_count integer,
  status text,
  station_id uuid,
  current_charge integer,
  charge_started_at timestamptz,
  disposal_confirmed_at timestamptz,
  history_id uuid,
  changed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.admin_register_battery(
    p_battery_id,
    p_model_name,
    p_capacity,
    p_cycle_life,
    p_station_id
  )
$$;

create or replace function public.admin_relocate_battery(
  p_battery_id uuid,
  p_origin_station_id uuid,
  p_destination_station_id uuid
)
returns table (
  battery_id uuid,
  origin_station_id uuid,
  destination_station_id uuid,
  status text,
  charge_started_at timestamptz,
  history_id uuid,
  changed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.admin_relocate_battery(
    p_battery_id,
    p_origin_station_id,
    p_destination_station_id
  )
$$;

create or replace function public.admin_list_batteries()
returns table (
  battery_id uuid,
  model_name text,
  capacity integer,
  cycle_life integer,
  used_count integer,
  status text,
  station_id uuid,
  station_name text,
  current_charge integer,
  charge_started_at timestamptz,
  disposal_confirmed_at timestamptz,
  charge_simulation_elapsed_seconds numeric,
  charge_time_anchor_at timestamptz,
  charge_time_scale numeric,
  can_relocate boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.admin_list_batteries()
$$;

revoke insert, update on table public.batteries from authenticated;

revoke execute on function private.admin_register_battery(uuid, text, integer, integer, uuid)
  from public, anon;
revoke execute on function private.admin_relocate_battery(uuid, uuid, uuid)
  from public, anon;
revoke execute on function private.admin_list_batteries()
  from public, anon;
grant execute on function private.admin_register_battery(uuid, text, integer, integer, uuid)
  to authenticated;
grant execute on function private.admin_relocate_battery(uuid, uuid, uuid)
  to authenticated;
grant execute on function private.admin_list_batteries()
  to authenticated;

revoke execute on function public.admin_register_battery(uuid, text, integer, integer, uuid)
  from public, anon;
revoke execute on function public.admin_relocate_battery(uuid, uuid, uuid)
  from public, anon;
revoke execute on function public.admin_list_batteries()
  from public, anon;
grant execute on function public.admin_register_battery(uuid, text, integer, integer, uuid)
  to authenticated;
grant execute on function public.admin_relocate_battery(uuid, uuid, uuid)
  to authenticated;
grant execute on function public.admin_list_batteries()
  to authenticated;

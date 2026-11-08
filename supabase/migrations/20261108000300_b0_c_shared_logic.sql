alter table public.system_settings
  add column demo_mode_enabled boolean not null default false;

alter table public.rentals
  add column simulation_elapsed_seconds numeric not null default 0,
  add column simulation_anchor_at timestamptz,
  add column simulation_time_scale numeric;

update public.rentals
set
  simulation_anchor_at = rental_time,
  simulation_time_scale = (
    select settings.time_scale
    from public.system_settings as settings
    where settings.settings_id = 1
  );

alter table public.rentals
  alter column simulation_anchor_at set not null,
  alter column simulation_time_scale set not null,
  add constraint rentals_simulation_elapsed_seconds_check
    check (
      simulation_elapsed_seconds >= 0
      and simulation_elapsed_seconds <> 'NaN'::numeric
      and simulation_elapsed_seconds <> 'Infinity'::numeric
    ),
  add constraint rentals_simulation_time_scale_check
    check (
      simulation_time_scale > 0
      and simulation_time_scale <> 'NaN'::numeric
      and simulation_time_scale <> 'Infinity'::numeric
    );

alter table public.batteries
  add column charge_simulation_elapsed_seconds numeric not null default 0,
  add column charge_time_anchor_at timestamptz,
  add column charge_time_scale numeric;

update public.batteries
set
  charge_time_anchor_at = case
    when status = 'Charging' then coalesce(charge_started_at, clock_timestamp())
    else null
  end,
  charge_time_scale = (
    select settings.time_scale
    from public.system_settings as settings
    where settings.settings_id = 1
  );

alter table public.batteries
  alter column charge_time_scale set not null,
  add constraint batteries_charge_simulation_elapsed_seconds_check
    check (
      charge_simulation_elapsed_seconds >= 0
      and charge_simulation_elapsed_seconds <> 'NaN'::numeric
      and charge_simulation_elapsed_seconds <> 'Infinity'::numeric
    ),
  add constraint batteries_charge_time_scale_check
    check (
      charge_time_scale > 0
      and charge_time_scale <> 'NaN'::numeric
      and charge_time_scale <> 'Infinity'::numeric
    ),
  add constraint batteries_charging_anchor_check
    check (status <> 'Charging' or charge_time_anchor_at is not null);

create or replace function private.initialize_rental_simulation_clock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.simulation_elapsed_seconds := coalesce(new.simulation_elapsed_seconds, 0);
  new.simulation_anchor_at := coalesce(
    new.simulation_anchor_at,
    new.rental_time,
    clock_timestamp()
  );

  if new.simulation_time_scale is null then
    select settings.time_scale
    into new.simulation_time_scale
    from public.system_settings as settings
    where settings.settings_id = 1
    for share;
  end if;

  return new;
end;
$$;

create trigger rentals_initialize_simulation_clock
before insert on public.rentals
for each row
execute function private.initialize_rental_simulation_clock();

create or replace function private.initialize_battery_charge_clock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.charge_time_scale is null then
    select settings.time_scale
    into new.charge_time_scale
    from public.system_settings as settings
    where settings.settings_id = 1
    for share;
  end if;

  if new.status = 'Charging' and tg_op = 'INSERT' then
    new.charge_simulation_elapsed_seconds := 0;
    new.charge_started_at := coalesce(new.charge_started_at, clock_timestamp());
    new.charge_time_anchor_at := new.charge_started_at;

    select settings.time_scale
    into new.charge_time_scale
    from public.system_settings as settings
    where settings.settings_id = 1
    for share;
  elsif tg_op = 'UPDATE' then
    if new.status = 'Charging' and (
      old.status <> 'Charging'
      or new.charge_started_at is distinct from old.charge_started_at
    ) then
      new.charge_simulation_elapsed_seconds := 0;
      if old.status <> 'Charging'
        and new.charge_started_at is not distinct from old.charge_started_at
      then
        new.charge_started_at := clock_timestamp();
      else
        new.charge_started_at := coalesce(
          new.charge_started_at,
          clock_timestamp()
        );
      end if;
      new.charge_time_anchor_at := new.charge_started_at;

      select settings.time_scale
      into new.charge_time_scale
      from public.system_settings as settings
      where settings.settings_id = 1
      for share;
    end if;
  end if;

  return new;
end;
$$;

create trigger batteries_initialize_charge_clock
before insert or update of status, charge_started_at on public.batteries
for each row
execute function private.initialize_battery_charge_clock();

create or replace function private.guard_direct_time_scale_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.time_scale is distinct from old.time_scale
    and current_user <> 'postgres'
  then
    raise exception 'time_scale must be changed through set_simulation_time_scale()'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger system_settings_guard_time_scale
before update of time_scale on public.system_settings
for each row
execute function private.guard_direct_time_scale_update();

alter table public.system_settings
  add constraint system_settings_time_scale_finite_check
    check (
      time_scale <> 'NaN'::numeric
      and time_scale <> 'Infinity'::numeric
    );

create or replace function private.checkpoint_simulation_time_scale(
  new_time_scale numeric,
  effective_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo_enabled boolean;
begin
  if not (select private.is_admin()) then
    raise exception 'administrator access is required'
      using errcode = '42501';
  end if;

  if new_time_scale is null
    or new_time_scale = 'NaN'::numeric
    or new_time_scale = 'Infinity'::numeric
    or new_time_scale <= 0
  then
    raise exception 'time_scale must be greater than zero'
      using errcode = '22023';
  end if;

  if effective_at is null or effective_at > clock_timestamp() then
    raise exception 'effective_at must not be null or in the future'
      using errcode = '22023';
  end if;

  select settings.demo_mode_enabled
  into demo_enabled
  from public.system_settings as settings
  where settings.settings_id = 1
  for update;

  if not demo_enabled then
    raise exception 'simulation demo mode is disabled'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.rentals as rental
    where rental.return_time is null
      and rental.simulation_anchor_at > effective_at
  ) or exists (
    select 1
    from public.batteries as battery
    where battery.status = 'Charging'
      and battery.charge_time_anchor_at > effective_at
  ) then
    raise exception 'effective_at precedes an active simulation anchor'
      using errcode = '22023';
  end if;

  update public.rentals as rental
  set
    simulation_elapsed_seconds =
      rental.simulation_elapsed_seconds
      + extract(epoch from (effective_at - rental.simulation_anchor_at))
        * rental.simulation_time_scale,
    simulation_anchor_at = effective_at,
    simulation_time_scale = new_time_scale
  where rental.return_time is null;

  update public.batteries as battery
  set
    charge_simulation_elapsed_seconds =
      battery.charge_simulation_elapsed_seconds
      + extract(epoch from (effective_at - battery.charge_time_anchor_at))
        * battery.charge_time_scale,
    charge_time_anchor_at = effective_at,
    charge_time_scale = new_time_scale
  where battery.status = 'Charging';

  update public.system_settings
  set time_scale = new_time_scale
  where settings_id = 1;
end;
$$;

create or replace function public.set_simulation_time_scale(
  new_time_scale numeric,
  effective_at timestamptz default clock_timestamp()
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.checkpoint_simulation_time_scale(new_time_scale, effective_at)
$$;

revoke execute on function private.initialize_rental_simulation_clock() from public;
revoke execute on function private.initialize_battery_charge_clock() from public;
revoke execute on function private.guard_direct_time_scale_update() from public;
revoke execute on function private.checkpoint_simulation_time_scale(numeric, timestamptz)
  from public, anon;
grant execute on function private.checkpoint_simulation_time_scale(numeric, timestamptz)
  to authenticated;

revoke execute on function public.set_simulation_time_scale(numeric, timestamptz)
  from public, anon;
grant execute on function public.set_simulation_time_scale(numeric, timestamptz)
  to authenticated;

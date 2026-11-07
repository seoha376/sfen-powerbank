create extension if not exists pgcrypto with schema extensions;

create table public.app_users (
  user_id text primary key,
  auth_user_id uuid unique,
  user_name text not null,
  role text not null,
  user_status text,
  approval_status text,
  eligibility_status boolean not null default false,
  suspension_type text not null default 'none',
  suspended_until timestamptz,
  graduation_year integer,
  certificate_file text,
  constraint app_users_user_name_not_blank_check
    check (btrim(user_name) <> ''),
  constraint app_users_role_check
    check (role in ('user', 'administrator')),
  constraint app_users_user_status_check
    check (user_status is null or user_status in ('Enrolled', 'Graduated')),
  constraint app_users_approval_status_check
    check (
      approval_status is null
      or approval_status in ('Pending', 'Approved', 'Rejected')
    ),
  constraint app_users_suspension_type_check
    check (suspension_type in ('none', 'temporary', 'permanent')),
  constraint app_users_login_id_format_check
    check (
      btrim(user_id) <> ''
      and (role = 'administrator' or user_id ~ '^[0-9]{8}$')
    )
);

create table public.stations (
  station_id uuid primary key default gen_random_uuid(),
  station_name text not null,
  location text not null,
  slot_capacity integer not null,
  constraint stations_station_name_not_blank_check
    check (btrim(station_name) <> ''),
  constraint stations_location_not_blank_check
    check (btrim(location) <> ''),
  constraint stations_slot_capacity_check
    check (slot_capacity >= 0)
);

create table public.batteries (
  battery_id uuid primary key default gen_random_uuid(),
  model_name text not null,
  capacity integer not null,
  cycle_life integer not null,
  used_count integer not null default 0,
  status text not null default 'Charging',
  station_id uuid,
  current_charge integer not null default 0,
  charge_started_at timestamptz,
  disposal_confirmed_at timestamptz,
  constraint batteries_station_id_fkey
    foreign key (station_id)
    references public.stations (station_id)
    on delete restrict,
  constraint batteries_model_name_not_blank_check
    check (btrim(model_name) <> ''),
  constraint batteries_capacity_check
    check (capacity > 0),
  constraint batteries_cycle_life_check
    check (cycle_life >= 1),
  constraint batteries_used_count_check
    check (used_count >= 0),
  constraint batteries_status_check
    check (
      status in (
        'Charging',
        'Available',
        'Rented',
        'Overdue',
        'Lost',
        'UnderRepair',
        'Disposed'
      )
    ),
  constraint batteries_current_charge_check
    check (current_charge between 0 and 100)
);

create table public.rentals (
  rental_id uuid primary key default gen_random_uuid(),
  user_id text not null,
  battery_id uuid not null,
  rental_station_id uuid not null,
  rental_time timestamptz not null default now(),
  return_station_id uuid,
  return_time timestamptz,
  penalty_type text,
  compensation_multiplier integer not null default 0,
  compensation_confirmed_at timestamptz,
  constraint rentals_user_id_fkey
    foreign key (user_id)
    references public.app_users (user_id)
    on delete restrict,
  constraint rentals_battery_id_fkey
    foreign key (battery_id)
    references public.batteries (battery_id)
    on delete restrict,
  constraint rentals_rental_station_id_fkey
    foreign key (rental_station_id)
    references public.stations (station_id)
    on delete restrict,
  constraint rentals_return_station_id_fkey
    foreign key (return_station_id)
    references public.stations (station_id)
    on delete restrict,
  constraint rentals_return_time_check
    check (return_time is null or return_time >= rental_time),
  constraint rentals_compensation_multiplier_check
    check (compensation_multiplier in (0, 1, 3))
);

create table public.battery_status_history (
  history_id uuid primary key default gen_random_uuid(),
  battery_id uuid not null,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now(),
  changed_by text,
  station_id uuid,
  reason text,
  rental_id uuid,
  constraint battery_status_history_battery_id_fkey
    foreign key (battery_id)
    references public.batteries (battery_id)
    on delete restrict,
  constraint battery_status_history_changed_by_fkey
    foreign key (changed_by)
    references public.app_users (user_id)
    on delete restrict,
  constraint battery_status_history_station_id_fkey
    foreign key (station_id)
    references public.stations (station_id)
    on delete restrict,
  constraint battery_status_history_rental_id_fkey
    foreign key (rental_id)
    references public.rentals (rental_id)
    on delete restrict,
  constraint battery_status_history_from_status_check
    check (
      from_status is null
      or from_status in (
        'Charging',
        'Available',
        'Rented',
        'Overdue',
        'Lost',
        'UnderRepair',
        'Disposed'
      )
    ),
  constraint battery_status_history_to_status_check
    check (
      to_status in (
        'Charging',
        'Available',
        'Rented',
        'Overdue',
        'Lost',
        'UnderRepair',
        'Disposed'
      )
    ),
  constraint battery_status_history_initial_registration_check
    check (from_status is not null or to_status = 'Charging')
);

create table public.system_settings (
  settings_id smallint primary key default 1,
  rental_period_days integer not null default 7,
  long_term_days integer not null default 60,
  time_scale numeric not null default 1,
  battery_unit_price integer not null default 30000,
  constraint system_settings_singleton_check
    check (settings_id = 1),
  constraint system_settings_rental_period_days_check
    check (rental_period_days > 0),
  constraint system_settings_long_term_days_check
    check (long_term_days > rental_period_days),
  constraint system_settings_time_scale_check
    check (time_scale > 0),
  constraint system_settings_battery_unit_price_check
    check (battery_unit_price > 0)
);

insert into public.system_settings (settings_id)
values (1)
on conflict (settings_id) do nothing;

create index batteries_station_id_idx on public.batteries (station_id);
create index batteries_status_idx on public.batteries (status);
create index rentals_user_id_idx on public.rentals (user_id);
create index rentals_battery_id_idx on public.rentals (battery_id);
create index rentals_active_battery_id_idx
  on public.rentals (battery_id)
  where return_time is null;
create index battery_status_history_battery_changed_at_idx
  on public.battery_status_history (battery_id, changed_at desc);
create index battery_status_history_rental_id_idx
  on public.battery_status_history (rental_id);

alter table public.app_users enable row level security;
alter table public.stations enable row level security;
alter table public.batteries enable row level security;
alter table public.rentals enable row level security;
alter table public.battery_status_history enable row level security;
alter table public.system_settings enable row level security;

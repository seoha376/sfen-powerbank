import type { SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseClient } from "@/lib/supabase"

export interface StationOverview {
  readonly stationId: string
  readonly stationName: string
  readonly location: string
  readonly slotCapacity: number
  readonly availableCount: number
  readonly occupiedSlotCount: number
  readonly remainingSlotCount: number
}

export interface StationInput {
  readonly stationName: string
  readonly location: string
  readonly slotCapacity: number
}

interface StationOverviewRow {
  station_id: string
  station_name: string
  location: string
  slot_capacity: number
  available_count: number
  occupied_slot_count: number
  remaining_slot_count?: number
}

function toOverview(row: StationOverviewRow): StationOverview {
  return {
    stationId: row.station_id,
    stationName: row.station_name,
    location: row.location,
    slotCapacity: row.slot_capacity,
    availableCount: row.available_count,
    occupiedSlotCount: row.occupied_slot_count,
    remainingSlotCount:
      row.remaining_slot_count ??
      Math.max(0, row.slot_capacity - row.occupied_slot_count),
  }
}

function firstRow(data: unknown): StationOverviewRow {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") {
    throw new Error("Station operation returned no result.")
  }
  return row as StationOverviewRow
}

export async function listStations(
  client: SupabaseClient = getSupabaseClient(),
): Promise<StationOverview[]> {
  const { data, error } = await client
    .from("station_inventory")
    .select(
      "station_id, station_name, location, slot_capacity, available_count, occupied_slot_count, remaining_slot_count",
    )
    .order("station_name")

  if (error) throw error
  return ((data ?? []) as StationOverviewRow[]).map(toOverview)
}

export async function createStation(
  input: StationInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<StationOverview> {
  const { data, error } = await client.rpc("admin_create_station", {
    p_station_name: input.stationName,
    p_location: input.location,
    p_slot_capacity: input.slotCapacity,
  })

  if (error) throw error
  return toOverview(firstRow(data))
}

export async function updateStation(
  stationId: string,
  input: StationInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<StationOverview> {
  const { data, error } = await client.rpc("admin_update_station", {
    p_station_id: stationId,
    p_station_name: input.stationName,
    p_location: input.location,
    p_slot_capacity: input.slotCapacity,
  })

  if (error) throw error
  return toOverview(firstRow(data))
}

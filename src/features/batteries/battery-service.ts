import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  RegisterBatteryInput,
  RegisterBatteryOutput,
  RelocateBatteryInput,
  RelocateBatteryOutput,
} from "@/contracts/transactions"
import type { BatteryStatus } from "@/domain/battery-status"
import { getSupabaseClient } from "@/lib/supabase"

export type { RegisterBatteryInput, RelocateBatteryInput }

export interface BatteryOverview {
  readonly batteryId: string
  readonly modelName: string
  readonly capacity: number
  readonly cycleLife: number
  readonly usedCount: number
  readonly status: BatteryStatus
  readonly stationId: string | null
  readonly currentCharge: number
  readonly chargeStartedAt: string | null
  readonly disposalConfirmedAt: string | null
}

interface BatteryOverviewRow {
  battery_id: string
  model_name: string
  capacity: number
  cycle_life: number
  used_count: number
  status: BatteryStatus
  station_id: string | null
  current_charge: number
  charge_started_at: string | null
  disposal_confirmed_at: string | null
}

interface RegisterBatteryRow {
  battery_id: string
  status: BatteryStatus
  history_id: string
  changed_at: string
}

interface RelocateBatteryRow extends RegisterBatteryRow {
  origin_station_id: string
  destination_station_id: string
}

function firstRow<Row>(data: unknown, operation: string): Row {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") {
    throw new Error(`${operation} returned no result.`)
  }
  return row as Row
}

function toOverview(row: BatteryOverviewRow): BatteryOverview {
  return {
    batteryId: row.battery_id,
    modelName: row.model_name,
    capacity: row.capacity,
    cycleLife: row.cycle_life,
    usedCount: row.used_count,
    status: row.status,
    stationId: row.station_id,
    currentCharge: row.current_charge,
    chargeStartedAt: row.charge_started_at,
    disposalConfirmedAt: row.disposal_confirmed_at,
  }
}

export async function listBatteries(
  client: SupabaseClient = getSupabaseClient(),
): Promise<BatteryOverview[]> {
  const { data, error } = await client.rpc("admin_list_batteries")

  if (error) throw error
  return ((data ?? []) as BatteryOverviewRow[]).map(toOverview)
}

export async function registerBattery(
  input: RegisterBatteryInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<RegisterBatteryOutput> {
  const { data, error } = await client.rpc("admin_register_battery", {
    p_battery_id: input.batteryId,
    p_model_name: input.modelName,
    p_capacity: input.capacity,
    p_cycle_life: input.cycleLife,
    p_station_id: input.stationId,
  })

  if (error) throw error
  const row = firstRow<RegisterBatteryRow>(data, "Battery registration")
  return {
    batteryId: row.battery_id,
    receipt: {
      occurredAt: row.changed_at,
      historyId: row.history_id,
      batteryId: row.battery_id,
      fromStatus: null,
      toStatus: row.status,
    },
  }
}

export async function relocateBattery(
  input: RelocateBatteryInput,
  client: SupabaseClient = getSupabaseClient(),
): Promise<RelocateBatteryOutput> {
  const { data, error } = await client.rpc("admin_relocate_battery", {
    p_battery_id: input.batteryId,
    p_origin_station_id: input.originStationId,
    p_destination_station_id: input.destinationStationId,
  })

  if (error) throw error
  const row = firstRow<RelocateBatteryRow>(data, "Battery relocation")
  return {
    originStationId: row.origin_station_id,
    destinationStationId: row.destination_station_id,
    receipt: {
      occurredAt: row.changed_at,
      historyId: row.history_id,
      batteryId: row.battery_id,
      fromStatus: row.status,
      toStatus: row.status,
    },
  }
}

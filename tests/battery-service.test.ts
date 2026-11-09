import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import {
  listBatteries,
  registerBattery,
  relocateBattery,
} from "@/features/batteries/battery-service"

function clientWithRpc(rpc: ReturnType<typeof vi.fn>): SupabaseClient {
  return { rpc } as unknown as SupabaseClient
}

describe("battery service RPC contract", () => {
  it("maps the administrator battery list response", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          battery_id: "20000000-0000-4000-8000-000000000001",
          model_name: "SFEN-10K",
          capacity: 10000,
          cycle_life: 500,
          used_count: 0,
          status: "Charging",
          station_id: "10000000-0000-4000-8000-000000000001",
          current_charge: 0,
          charge_started_at: "2026-11-09T00:00:00Z",
          disposal_confirmed_at: null,
        },
      ],
      error: null,
    })

    await expect(listBatteries(clientWithRpc(rpc))).resolves.toEqual([
      {
        batteryId: "20000000-0000-4000-8000-000000000001",
        modelName: "SFEN-10K",
        capacity: 10000,
        cycleLife: 500,
        usedCount: 0,
        status: "Charging",
        stationId: "10000000-0000-4000-8000-000000000001",
        currentCharge: 0,
        chargeStartedAt: "2026-11-09T00:00:00Z",
        disposalConfirmedAt: null,
      },
    ])
    expect(rpc).toHaveBeenCalledWith("admin_list_batteries")
  })

  it("passes the registration input to the transaction RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        battery_id: "20000000-0000-4000-8000-000000000001",
        status: "Charging",
        history_id: "40000000-0000-4000-8000-000000000001",
        changed_at: "2026-11-09T00:00:00Z",
      }],
      error: null,
    })
    const input = {
      batteryId: "20000000-0000-4000-8000-000000000001",
      modelName: "SFEN-10K",
      capacity: 10000,
      cycleLife: 500,
      stationId: "10000000-0000-4000-8000-000000000001",
    }

    await expect(registerBattery(input, clientWithRpc(rpc))).resolves.toEqual({
      batteryId: input.batteryId,
      receipt: {
        occurredAt: "2026-11-09T00:00:00Z",
        historyId: "40000000-0000-4000-8000-000000000001",
        batteryId: input.batteryId,
        fromStatus: null,
        toStatus: "Charging",
      },
    })

    expect(rpc).toHaveBeenCalledWith("admin_register_battery", {
      p_battery_id: input.batteryId,
      p_model_name: input.modelName,
      p_capacity: input.capacity,
      p_cycle_life: input.cycleLife,
      p_station_id: input.stationId,
    })
  })

  it("passes both stations to the relocation transaction RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        battery_id: "20000000-0000-4000-8000-000000000001",
        origin_station_id: "10000000-0000-4000-8000-000000000001",
        destination_station_id: "10000000-0000-4000-8000-000000000002",
        status: "Charging",
        history_id: "40000000-0000-4000-8000-000000000002",
        changed_at: "2026-11-09T00:05:00Z",
      }],
      error: null,
    })
    const input = {
      batteryId: "20000000-0000-4000-8000-000000000001",
      originStationId: "10000000-0000-4000-8000-000000000001",
      destinationStationId: "10000000-0000-4000-8000-000000000002",
    }

    await expect(relocateBattery(input, clientWithRpc(rpc))).resolves.toEqual({
      originStationId: input.originStationId,
      destinationStationId: input.destinationStationId,
      receipt: {
        occurredAt: "2026-11-09T00:05:00Z",
        historyId: "40000000-0000-4000-8000-000000000002",
        batteryId: input.batteryId,
        fromStatus: "Charging",
        toStatus: "Charging",
      },
    })

    expect(rpc).toHaveBeenCalledWith("admin_relocate_battery", {
      p_battery_id: input.batteryId,
      p_origin_station_id: input.originStationId,
      p_destination_station_id: input.destinationStationId,
    })
  })
})

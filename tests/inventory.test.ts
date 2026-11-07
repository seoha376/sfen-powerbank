import { describe, expect, it } from "vitest"

import { countAvailableInventory } from "@/domain/inventory"

const batteries = [
  { batteryId: "battery-1", stationId: "station-a", status: "Available" },
  { batteryId: "battery-2", stationId: "station-a", status: "Charging" },
  { batteryId: "battery-3", stationId: "station-b", status: "Available" },
  { batteryId: "battery-4", stationId: null, status: "Rented" },
] as const

describe("available inventory", () => {
  it("counts only batteries whose current status is Available", () => {
    expect(countAvailableInventory(batteries)).toBe(2)
  })

  it("limits the count to the requested station", () => {
    expect(countAvailableInventory(batteries, "station-a")).toBe(1)
    expect(countAvailableInventory(batteries, "station-b")).toBe(1)
    expect(countAvailableInventory(batteries, "station-c")).toBe(0)
  })

  it("returns zero for an empty battery collection", () => {
    expect(countAvailableInventory([])).toBe(0)
  })
})

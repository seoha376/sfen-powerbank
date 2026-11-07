import { describe, expect, it } from "vitest"

import {
  BATTERY_STATUSES,
  canTransitionBatteryStatus,
  isBatteryAvailableForRental,
  occupiesStationSlot,
  type BatteryStatus,
} from "@/domain/battery-status"

describe("battery status transitions", () => {
  const allowedTransitions: ReadonlyArray<
    readonly [BatteryStatus | null, BatteryStatus]
  > = [
    [null, "Charging"],
    ["Charging", "Available"],
    ["Charging", "UnderRepair"],
    ["Charging", "Disposed"],
    ["Available", "Rented"],
    ["Rented", "Charging"],
    ["Rented", "Overdue"],
    ["Rented", "Lost"],
    ["Overdue", "Charging"],
    ["Overdue", "Lost"],
    ["Overdue", "Disposed"],
    ["Lost", "Disposed"],
    ["UnderRepair", "Charging"],
    ["UnderRepair", "Disposed"],
  ]

  it.each(allowedTransitions)("allows %s -> %s", (from, to) => {
    expect(canTransitionBatteryStatus(from, to)).toBe(true)
  })

  it.each([
    [null, "Available"],
    ["Available", "Charging"],
    ["Charging", "Rented"],
    ["Lost", "Charging"],
    ["UnderRepair", "Available"],
  ] satisfies ReadonlyArray<readonly [BatteryStatus | null, BatteryStatus]>) (
    "rejects %s -> %s",
    (from, to) => {
      expect(canTransitionBatteryStatus(from, to)).toBe(false)
    },
  )

  it.each(BATTERY_STATUSES)("rejects Disposed -> %s", (to) => {
    expect(
      canTransitionBatteryStatus("Disposed", to, { relocation: true }),
    ).toBe(false)
  })

  it.each(["Charging", "Available", "UnderRepair"] as const)(
    "allows explicit relocation while remaining %s",
    (status) => {
      expect(
        canTransitionBatteryStatus(status, status, { relocation: true }),
      ).toBe(true)
    },
  )

  it.each(["Charging", "Available", "UnderRepair"] as const)(
    "rejects an unmarked same-state %s event",
    (status) => {
      expect(canTransitionBatteryStatus(status, status)).toBe(false)
    },
  )

  it.each(["Rented", "Overdue", "Lost"] as const)(
    "rejects relocation while %s",
    (status) => {
      expect(
        canTransitionBatteryStatus(status, status, { relocation: true }),
      ).toBe(false)
    },
  )
})

describe("battery status classifications", () => {
  it.each([
    ["Charging", true],
    ["Available", true],
    ["UnderRepair", true],
    ["Rented", false],
    ["Overdue", false],
    ["Lost", false],
    ["Disposed", false],
  ] satisfies ReadonlyArray<readonly [BatteryStatus, boolean]>)(
    "classifies %s station-slot occupancy as %s",
    (status, expected) => {
      expect(occupiesStationSlot(status)).toBe(expected)
    },
  )

  it.each(BATTERY_STATUSES)(
    "allows rental only for Available, not %s by default",
    (status) => {
      expect(isBatteryAvailableForRental(status)).toBe(status === "Available")
    },
  )
})

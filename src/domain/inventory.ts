import {
  isBatteryAvailableForRental,
  type BatteryStatus,
} from "@/domain/battery-status"

export interface BatteryInventoryItem {
  readonly batteryId: string
  readonly stationId: string | null
  readonly status: BatteryStatus
}

export function countAvailableInventory(
  batteries: ReadonlyArray<BatteryInventoryItem>,
  stationId?: string,
): number {
  return batteries.filter(
    (battery) =>
      isBatteryAvailableForRental(battery.status) &&
      (stationId === undefined || battery.stationId === stationId),
  ).length
}

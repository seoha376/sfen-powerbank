export const BATTERY_STATUSES = [
  "Charging",
  "Available",
  "Rented",
  "Overdue",
  "Lost",
  "UnderRepair",
  "Disposed",
] as const

export type BatteryStatus = (typeof BATTERY_STATUSES)[number]

export interface BatteryTransitionOptions {
  relocation?: boolean
}

const STATION_SLOT_STATUSES = new Set<BatteryStatus>([
  "Charging",
  "Available",
  "UnderRepair",
])

const ALLOWED_TRANSITIONS: Readonly<Record<BatteryStatus, ReadonlySet<BatteryStatus>>> = {
  Charging: new Set(["Available", "UnderRepair", "Disposed"]),
  Available: new Set(["Rented"]),
  Rented: new Set(["Charging", "Overdue", "Lost"]),
  Overdue: new Set(["Charging", "Lost", "Disposed"]),
  Lost: new Set(["Disposed"]),
  UnderRepair: new Set(["Charging", "Disposed"]),
  Disposed: new Set(),
}

export function canTransitionBatteryStatus(
  from: BatteryStatus | null,
  to: BatteryStatus,
  options: BatteryTransitionOptions = {},
): boolean {
  if (from === null) {
    return to === "Charging"
  }

  if (from === "Disposed") {
    return false
  }

  if (from === to) {
    return options.relocation === true && occupiesStationSlot(from)
  }

  return ALLOWED_TRANSITIONS[from].has(to)
}

export function occupiesStationSlot(status: BatteryStatus): boolean {
  return STATION_SLOT_STATUSES.has(status)
}

export function isBatteryAvailableForRental(status: BatteryStatus): boolean {
  return status === "Available"
}

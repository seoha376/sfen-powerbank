import type { BatteryStatus } from "@/domain/battery-status"

export interface RentalActivityInput {
  readonly returnTime: string | null
}

export function isActiveUnreturnedRental(
  rental: RentalActivityInput,
  batteryStatus: BatteryStatus,
): boolean {
  return (
    rental.returnTime === null &&
    (batteryStatus === "Rented" || batteryStatus === "Overdue")
  )
}

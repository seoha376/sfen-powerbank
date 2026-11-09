import type { BatteryStatus } from "@/domain/battery-status"
import type {
  SimulationEvent,
  SimulationOutcomeMap,
} from "@/domain/probability"

export type ActorRole = "user" | "administrator" | "system"

export interface TransactionActor {
  readonly authUserId: string
  readonly appUserId: string
  readonly role: ActorRole
}

export type TransactionErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "USER_NOT_ELIGIBLE"
  | "USER_SUSPENDED"
  | "BATTERY_NOT_FOUND"
  | "BATTERY_NOT_AVAILABLE"
  | "INVALID_STATUS_TRANSITION"
  | "ACTIVE_RENTAL_EXISTS"
  | "RENTAL_NOT_FOUND"
  | "RENTAL_ALREADY_RETURNED"
  | "STATION_NOT_FOUND"
  | "STATION_CAPACITY_EXCEEDED"
  | "CONCURRENT_MODIFICATION"
  | "DEMO_MODE_DISABLED"
  | "FORCED_RESULT_FORBIDDEN"

export interface TransactionReceipt {
  readonly occurredAt: string
  readonly historyId: string
  readonly batteryId: string
  readonly fromStatus: BatteryStatus | null
  readonly toStatus: BatteryStatus
}

export interface RegisterBatteryInput {
  readonly batteryId: string
  readonly modelName: string
  readonly capacity: number
  readonly cycleLife: number
  readonly stationId: string
}

export interface RegisterBatteryOutput {
  readonly batteryId: string
  readonly receipt: TransactionReceipt
}

export interface RelocateBatteryInput {
  readonly batteryId: string
  readonly originStationId: string
  readonly destinationStationId: string
}

export interface RelocateBatteryOutput {
  readonly originStationId: string
  readonly destinationStationId: string
  readonly receipt: TransactionReceipt
}

export interface StartRentalInput {
  readonly batteryId: string
  readonly stationId: string
  readonly userId: string
}

export interface StartRentalOutput {
  readonly rentalId: string
  readonly receipt: TransactionReceipt
}

export interface ReturnRentalInput {
  readonly rentalId: string
  readonly returnStationId: string
}

export interface ReturnRentalOutput {
  readonly returnedAt: string
  readonly usedCount: number
  readonly receipt: TransactionReceipt
}

export interface ChangeBatteryStatusInput {
  readonly batteryId: string
  readonly toStatus: BatteryStatus
  readonly reason: string
  readonly rentalId?: string
  readonly simulationDecision?: SimulationDecision
}

export type SimulationDecision = {
  readonly [Event in SimulationEvent]: {
    readonly event: Event
    readonly outcome: SimulationOutcomeMap[Event]
  }
}[SimulationEvent]

export interface ChangeBatteryStatusOutput {
  readonly receipt: TransactionReceipt
}

export interface TransactionContract {
  readonly ownerBlock: "B1" | "B3" | "B4" | "B5/B6"
  readonly permissions: readonly string[]
  readonly locks: readonly string[]
  readonly validations: readonly string[]
  readonly atomicWrites: readonly string[]
  readonly errors: readonly TransactionErrorCode[]
}

export const TRANSACTION_CONTRACTS = {
  registerBattery: {
    ownerBlock: "B1",
    permissions: ["administrator"],
    locks: ["destination station FOR UPDATE"],
    validations: [
      "station exists and has capacity",
      "battery ID is unique and numeric fields are valid",
      "initial transition is NULL -> Charging",
    ],
    atomicWrites: ["battery insert", "initial status history insert"],
    errors: [
      "FORBIDDEN",
      "STATION_NOT_FOUND",
      "STATION_CAPACITY_EXCEEDED",
      "INVALID_STATUS_TRANSITION",
    ],
  },
  relocateBattery: {
    ownerBlock: "B1",
    permissions: ["administrator"],
    locks: [
      "battery FOR UPDATE",
      "origin and destination stations FOR UPDATE in stable ID order",
    ],
    validations: [
      "battery is currently assigned to the supplied origin station",
      "origin and destination stations are different",
      "same-state relocation is limited to slot-occupying statuses",
      "destination station has capacity",
    ],
    atomicWrites: ["battery station update", "relocation history insert"],
    errors: [
      "FORBIDDEN",
      "BATTERY_NOT_FOUND",
      "STATION_NOT_FOUND",
      "STATION_CAPACITY_EXCEEDED",
      "INVALID_STATUS_TRANSITION",
    ],
  },
  startRental: {
    ownerBlock: "B3",
    permissions: ["same user or administrator acting for the user"],
    locks: ["app user FOR UPDATE", "battery FOR UPDATE"],
    validations: [
      "user is approved, eligible, and not suspended",
      "user has no active unreturned rental",
      "battery is Available at the requested station",
    ],
    atomicWrites: [
      "rental insert with simulation clock",
      "battery Available -> Rented update",
      "status history insert",
    ],
    errors: [
      "FORBIDDEN",
      "USER_NOT_ELIGIBLE",
      "USER_SUSPENDED",
      "ACTIVE_RENTAL_EXISTS",
      "BATTERY_NOT_AVAILABLE",
      "CONCURRENT_MODIFICATION",
    ],
  },
  returnRental: {
    ownerBlock: "B4",
    permissions: ["rental owner or administrator"],
    locks: [
      "rental FOR UPDATE",
      "battery FOR UPDATE",
      "return station FOR UPDATE",
    ],
    validations: [
      "rental is active and belongs to the actor",
      "return station has capacity",
      "Rented or Overdue -> Charging transition is valid",
    ],
    atomicWrites: [
      "rental return fields update",
      "battery status, station, used_count, and charge clock update",
      "status history insert",
    ],
    errors: [
      "FORBIDDEN",
      "RENTAL_NOT_FOUND",
      "RENTAL_ALREADY_RETURNED",
      "STATION_CAPACITY_EXCEEDED",
      "INVALID_STATUS_TRANSITION",
      "CONCURRENT_MODIFICATION",
    ],
  },
  changeBatteryStatus: {
    ownerBlock: "B5/B6",
    permissions: ["administrator or trusted server operation"],
    locks: ["battery FOR UPDATE", "related active rental FOR UPDATE"],
    validations: [
      "shared battery transition graph accepts the transition",
      "Disposed is terminal",
      "forced simulation outcome passed the administrator demo gate",
    ],
    atomicWrites: [
      "battery status and lifecycle fields update",
      "related rental penalty or compensation update when applicable",
      "status history insert",
    ],
    errors: [
      "FORBIDDEN",
      "BATTERY_NOT_FOUND",
      "INVALID_STATUS_TRANSITION",
      "DEMO_MODE_DISABLED",
      "FORCED_RESULT_FORBIDDEN",
      "CONCURRENT_MODIFICATION",
    ],
  },
} as const satisfies Record<string, TransactionContract>

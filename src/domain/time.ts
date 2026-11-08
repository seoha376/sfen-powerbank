export const MILLISECONDS_PER_MINUTE = 60_000
export const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE
export const CHARGE_PERCENTAGE_POINTS_PER_MINUTE = 10

export interface SystemTimeSettings {
  readonly rentalPeriodDays: number
  readonly longTermDays: number
  readonly timeScale: number
  readonly batteryUnitPrice: number
}

export const DEFAULT_SYSTEM_TIME_SETTINGS: SystemTimeSettings = {
  rentalPeriodDays: 7,
  longTermDays: 60,
  timeScale: 1,
  batteryUnitPrice: 30_000,
}

export type Timestamp = Date | string | number

export interface SimulationClockState {
  readonly accumulatedSimulatedMilliseconds: number
  readonly anchorAt: Timestamp
  readonly timeScale: number
}

export interface RentalTimeMetrics {
  readonly simulatedElapsedMilliseconds: number
  readonly rentalDays: number
  readonly overdueDays: number
  readonly isOverdue: boolean
  readonly isLongTermUnreturned: boolean
}

function timestampToMilliseconds(value: Timestamp, name: string): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime()

  if (!Number.isFinite(milliseconds)) {
    throw new Error(`${name} must be a valid timestamp.`)
  }

  return milliseconds
}

function requireNonNegativeFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative finite number.`)
  }
}

function requirePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite number.`)
  }
}

export function calculateElapsedMilliseconds(
  startedAt: Timestamp,
  now: Timestamp = Date.now(),
): number {
  const startMilliseconds = timestampToMilliseconds(startedAt, "startedAt")
  const nowMilliseconds = timestampToMilliseconds(now, "now")

  if (nowMilliseconds < startMilliseconds) {
    throw new Error("now must not be earlier than startedAt.")
  }

  return nowMilliseconds - startMilliseconds
}

export function calculateSimulatedElapsedMilliseconds(
  clock: SimulationClockState,
  now: Timestamp = Date.now(),
): number {
  requireNonNegativeFinite(
    clock.accumulatedSimulatedMilliseconds,
    "accumulatedSimulatedMilliseconds",
  )
  requirePositiveFinite(clock.timeScale, "timeScale")

  return (
    clock.accumulatedSimulatedMilliseconds +
    calculateElapsedMilliseconds(clock.anchorAt, now) * clock.timeScale
  )
}

export function checkpointSimulationClock(
  clock: SimulationClockState,
  nextTimeScale: number,
  at: Timestamp = Date.now(),
): SimulationClockState {
  requirePositiveFinite(nextTimeScale, "nextTimeScale")

  return {
    accumulatedSimulatedMilliseconds: calculateSimulatedElapsedMilliseconds(
      clock,
      at,
    ),
    anchorAt: at,
    timeScale: nextTimeScale,
  }
}

export function calculateRentalDays(
  simulatedElapsedMilliseconds: number,
): number {
  requireNonNegativeFinite(
    simulatedElapsedMilliseconds,
    "simulatedElapsedMilliseconds",
  )
  return Math.floor(simulatedElapsedMilliseconds / MILLISECONDS_PER_DAY)
}

export function isRentalOverdue(
  simulatedElapsedMilliseconds: number,
  rentalPeriodDays = DEFAULT_SYSTEM_TIME_SETTINGS.rentalPeriodDays,
): boolean {
  requireNonNegativeFinite(
    simulatedElapsedMilliseconds,
    "simulatedElapsedMilliseconds",
  )
  requirePositiveFinite(rentalPeriodDays, "rentalPeriodDays")
  return simulatedElapsedMilliseconds > rentalPeriodDays * MILLISECONDS_PER_DAY
}

export function calculateOverdueDays(
  simulatedElapsedMilliseconds: number,
  rentalPeriodDays = DEFAULT_SYSTEM_TIME_SETTINGS.rentalPeriodDays,
): number {
  if (!isRentalOverdue(simulatedElapsedMilliseconds, rentalPeriodDays)) {
    return 0
  }

  return Math.ceil(
    (simulatedElapsedMilliseconds - rentalPeriodDays * MILLISECONDS_PER_DAY) /
      MILLISECONDS_PER_DAY,
  )
}

export function isLongTermUnreturned(
  simulatedElapsedMilliseconds: number,
  longTermDays = DEFAULT_SYSTEM_TIME_SETTINGS.longTermDays,
): boolean {
  requireNonNegativeFinite(
    simulatedElapsedMilliseconds,
    "simulatedElapsedMilliseconds",
  )
  requirePositiveFinite(longTermDays, "longTermDays")
  return simulatedElapsedMilliseconds > longTermDays * MILLISECONDS_PER_DAY
}

export function calculateRentalTimeMetrics(
  clock: SimulationClockState,
  settings: Pick<SystemTimeSettings, "rentalPeriodDays" | "longTermDays"> =
    DEFAULT_SYSTEM_TIME_SETTINGS,
  now: Timestamp = Date.now(),
): RentalTimeMetrics {
  if (settings.longTermDays <= settings.rentalPeriodDays) {
    throw new Error("longTermDays must be greater than rentalPeriodDays.")
  }

  const simulatedElapsedMilliseconds = calculateSimulatedElapsedMilliseconds(
    clock,
    now,
  )

  return {
    simulatedElapsedMilliseconds,
    rentalDays: calculateRentalDays(simulatedElapsedMilliseconds),
    overdueDays: calculateOverdueDays(
      simulatedElapsedMilliseconds,
      settings.rentalPeriodDays,
    ),
    isOverdue: isRentalOverdue(
      simulatedElapsedMilliseconds,
      settings.rentalPeriodDays,
    ),
    isLongTermUnreturned: isLongTermUnreturned(
      simulatedElapsedMilliseconds,
      settings.longTermDays,
    ),
  }
}

export function calculateChargePercentage(
  initialCharge: number,
  simulatedElapsedMilliseconds: number,
  chargeRatePerMinute = CHARGE_PERCENTAGE_POINTS_PER_MINUTE,
): number {
  if (!Number.isFinite(initialCharge)) {
    throw new Error("initialCharge must be a finite number.")
  }
  requireNonNegativeFinite(
    simulatedElapsedMilliseconds,
    "simulatedElapsedMilliseconds",
  )
  requirePositiveFinite(chargeRatePerMinute, "chargeRatePerMinute")

  const boundedInitialCharge = Math.min(100, Math.max(0, initialCharge))
  const chargedPercentagePoints =
    (simulatedElapsedMilliseconds / MILLISECONDS_PER_MINUTE) *
    chargeRatePerMinute

  return Math.min(
    100,
    Math.floor(boundedInitialCharge + chargedPercentagePoints),
  )
}

export function calculateChargingPercentageAt(
  initialCharge: number,
  clock: SimulationClockState,
  now: Timestamp = Date.now(),
): number {
  return calculateChargePercentage(
    initialCharge,
    calculateSimulatedElapsedMilliseconds(clock, now),
  )
}

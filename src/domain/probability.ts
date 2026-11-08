export const SIMULATION_PROBABILITIES = {
  batteryUseFailure: 0.05,
  chargingFailure: 0.03,
  repairSuccess: 0.9,
  repairFailure: 0.1,
} as const

export interface SimulationOutcomeMap {
  readonly batteryUse: "normal" | "failure"
  readonly charging: "normal" | "failure"
  readonly repair: "success" | "failure"
}

export type SimulationEvent = keyof SimulationOutcomeMap
export type RandomSource = () => number

export interface DemoControl {
  readonly isAdmin: boolean
  readonly demoModeEnabled: boolean
  readonly demoModeAllowed?: boolean
}

export interface SimulationOptions<Event extends SimulationEvent> {
  readonly random?: RandomSource
  readonly forcedOutcome?: SimulationOutcomeMap[Event]
  readonly demoControl?: DemoControl
}

const VALID_OUTCOMES: {
  readonly [Event in SimulationEvent]: ReadonlySet<SimulationOutcomeMap[Event]>
} = {
  batteryUse: new Set(["normal", "failure"]),
  charging: new Set(["normal", "failure"]),
  repair: new Set(["success", "failure"]),
}

export function isDemoModeAllowedFromEnvironment(
  value: string | undefined,
): boolean {
  return value?.trim().toLowerCase() === "true"
}

export function canForceSimulationOutcome(
  control: DemoControl | undefined,
): boolean {
  return (
    control?.isAdmin === true &&
    control.demoModeEnabled === true &&
    control.demoModeAllowed === true
  )
}

function drawRandom(random: RandomSource): number {
  const value = random()

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random source must return a finite value from 0 up to 1.")
  }

  return value
}

export function resolveSimulationOutcome<Event extends SimulationEvent>(
  event: Event,
  options: SimulationOptions<Event> = {},
): SimulationOutcomeMap[Event] {
  if (options.forcedOutcome !== undefined) {
    if (!canForceSimulationOutcome(options.demoControl)) {
      throw new Error(
        "A forced simulation outcome requires an administrator with enabled and allowed demo mode.",
      )
    }

    if (!VALID_OUTCOMES[event].has(options.forcedOutcome)) {
      throw new Error(`Invalid forced outcome for ${event}.`)
    }

    return options.forcedOutcome
  }

  const value = drawRandom(options.random ?? Math.random)

  switch (event) {
    case "batteryUse":
      return (value < SIMULATION_PROBABILITIES.batteryUseFailure
        ? "failure"
        : "normal") as SimulationOutcomeMap[Event]
    case "charging":
      return (value < SIMULATION_PROBABILITIES.chargingFailure
        ? "failure"
        : "normal") as SimulationOutcomeMap[Event]
    case "repair":
      return (value < SIMULATION_PROBABILITIES.repairSuccess
        ? "success"
        : "failure") as SimulationOutcomeMap[Event]
  }

  throw new Error(`Unknown simulation event: ${String(event)}`)
}

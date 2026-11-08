import { describe, expect, it, vi } from "vitest"

import {
  canForceSimulationOutcome,
  isDemoModeAllowedFromEnvironment,
  resolveSimulationOutcome,
  SIMULATION_PROBABILITIES,
} from "@/domain/probability"

describe("simulation probabilities", () => {
  it("exposes the confirmed event probabilities", () => {
    expect(SIMULATION_PROBABILITIES).toEqual({
      batteryUseFailure: 0.05,
      chargingFailure: 0.03,
      repairSuccess: 0.9,
      repairFailure: 0.1,
    })
  })

  it.each([
    [0.049999, "failure"],
    [0.05, "normal"],
  ] as const)("resolves battery-use failure at the 5%% boundary", (draw, outcome) => {
    expect(resolveSimulationOutcome("batteryUse", { random: () => draw })).toBe(
      outcome,
    )
  })

  it.each([
    [0.029999, "failure"],
    [0.03, "normal"],
  ] as const)("resolves charging failure at the 3%% boundary", (draw, outcome) => {
    expect(resolveSimulationOutcome("charging", { random: () => draw })).toBe(
      outcome,
    )
  })

  it.each([
    [0.899999, "success"],
    [0.9, "failure"],
  ] as const)("resolves repair success and failure at the 90%% boundary", (draw, outcome) => {
    expect(resolveSimulationOutcome("repair", { random: () => draw })).toBe(
      outcome,
    )
  })

  it("uses an injected random source reproducibly", () => {
    const fixedRandom = () => 0.01

    expect(resolveSimulationOutcome("batteryUse", { random: fixedRandom })).toBe(
      "failure",
    )
    expect(resolveSimulationOutcome("batteryUse", { random: fixedRandom })).toBe(
      "failure",
    )
  })

  it("uses Math.random when no random source is injected", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99)

    expect(resolveSimulationOutcome("repair")).toBe("failure")
    expect(random).toHaveBeenCalledOnce()

    random.mockRestore()
  })

  it("allows an administrator to force an outcome only in allowed demo mode", () => {
    const random = vi.fn(() => {
      throw new Error("random should not be used for a forced outcome")
    })

    expect(
      resolveSimulationOutcome("batteryUse", {
        random,
        forcedOutcome: "normal",
        demoControl: {
          isAdmin: true,
          demoModeEnabled: true,
          demoModeAllowed: true,
        },
      }),
    ).toBe("normal")
    expect(random).not.toHaveBeenCalled()
  })

  it.each([
    { isAdmin: false, demoModeEnabled: true, demoModeAllowed: true },
    { isAdmin: true, demoModeEnabled: false, demoModeAllowed: true },
    { isAdmin: true, demoModeEnabled: true, demoModeAllowed: false },
    { isAdmin: true, demoModeEnabled: true },
  ])("rejects forced outcomes unless every server-side gate passes", (demoControl) => {
    expect(() =>
      resolveSimulationOutcome("repair", {
        forcedOutcome: "failure",
        demoControl,
      }),
    ).toThrow("requires an administrator with enabled and allowed demo mode")
  })

  it("rejects a forced outcome that does not belong to the event", () => {
    expect(() =>
      resolveSimulationOutcome("charging", {
        forcedOutcome: "success" as "normal",
        demoControl: {
          isAdmin: true,
          demoModeEnabled: true,
          demoModeAllowed: true,
        },
      }),
    ).toThrow("Invalid forced outcome for charging")
  })

  it.each([-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid injected random value %s",
    (draw) => {
      expect(() =>
        resolveSimulationOutcome("batteryUse", { random: () => draw }),
      ).toThrow("Random source must return a finite value from 0 up to 1")
    },
  )
})

describe("demo-mode environment gate", () => {
  it.each([undefined, "", "false", "1", "yes"])(
    "is disabled by default for %s",
    (value) => {
      expect(isDemoModeAllowedFromEnvironment(value)).toBe(false)
    },
  )

  it("accepts only an explicit true value", () => {
    expect(isDemoModeAllowedFromEnvironment(" TRUE ")).toBe(true)
    expect(
      canForceSimulationOutcome({
        isAdmin: true,
        demoModeEnabled: true,
        demoModeAllowed: true,
      }),
    ).toBe(true)
  })
})

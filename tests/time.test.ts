import { describe, expect, it } from "vitest"

import {
  calculateChargePercentage,
  calculateChargingPercentageAt,
  calculateElapsedMilliseconds,
  calculateOverdueDays,
  calculateRentalDays,
  calculateRentalTimeMetrics,
  calculateSimulatedElapsedMilliseconds,
  checkpointSimulationClock,
  DEFAULT_SYSTEM_TIME_SETTINGS,
  isLongTermUnreturned,
  isRentalOverdue,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
} from "@/domain/time"

const startedAt = new Date("2026-11-08T00:00:00.000Z")

describe("time and charging calculations", () => {
  it("exposes the SystemSetting defaults", () => {
    expect(DEFAULT_SYSTEM_TIME_SETTINGS).toEqual({
      rentalPeriodDays: 7,
      longTermDays: 60,
      timeScale: 1,
      batteryUnitPrice: 30_000,
    })
  })

  it("calculates elapsed time using an injected current time", () => {
    expect(
      calculateElapsedMilliseconds(
        startedAt,
        new Date("2026-11-08T00:02:30.000Z"),
      ),
    ).toBe(150_000)
  })

  it("applies timeScale to elapsed time", () => {
    expect(
      calculateSimulatedElapsedMilliseconds(
        {
          accumulatedSimulatedMilliseconds: 0,
          anchorAt: startedAt,
          timeScale: 3,
        },
        new Date("2026-11-08T00:10:00.000Z"),
      ),
    ).toBe(30 * MILLISECONDS_PER_MINUTE)
  })

  it("checkpoints old elapsed time before applying a changed timeScale", () => {
    const checkpointAt = new Date("2026-11-08T00:10:00.000Z")
    const checkpoint = checkpointSimulationClock(
      {
        accumulatedSimulatedMilliseconds: 0,
        anchorAt: startedAt,
        timeScale: 2,
      },
      3,
      checkpointAt,
    )

    expect(checkpoint.accumulatedSimulatedMilliseconds).toBe(
      20 * MILLISECONDS_PER_MINUTE,
    )
    expect(calculateSimulatedElapsedMilliseconds(checkpoint, checkpointAt)).toBe(
      20 * MILLISECONDS_PER_MINUTE,
    )
    expect(
      calculateSimulatedElapsedMilliseconds(
        checkpoint,
        new Date("2026-11-08T00:20:00.000Z"),
      ),
    ).toBe(50 * MILLISECONDS_PER_MINUTE)
  })

  it("uses strict 7-day and 60-day boundaries", () => {
    const sevenDays = 7 * MILLISECONDS_PER_DAY
    const sixtyDays = 60 * MILLISECONDS_PER_DAY

    expect(isRentalOverdue(sevenDays)).toBe(false)
    expect(isRentalOverdue(sevenDays + 1)).toBe(true)
    expect(calculateOverdueDays(sevenDays)).toBe(0)
    expect(calculateOverdueDays(sevenDays + 1)).toBe(1)
    expect(isLongTermUnreturned(sixtyDays)).toBe(false)
    expect(isLongTermUnreturned(sixtyDays + 1)).toBe(true)
  })

  it("calculates whole rental days and combined rental metrics", () => {
    expect(calculateRentalDays(7.75 * MILLISECONDS_PER_DAY)).toBe(7)

    const metrics = calculateRentalTimeMetrics(
      {
        accumulatedSimulatedMilliseconds: 0,
        anchorAt: startedAt,
        timeScale: 1,
      },
      DEFAULT_SYSTEM_TIME_SETTINGS,
      new Date(startedAt.getTime() + 8.25 * MILLISECONDS_PER_DAY),
    )

    expect(metrics).toMatchObject({
      rentalDays: 8,
      overdueDays: 2,
      isOverdue: true,
      isLongTermUnreturned: false,
    })
  })

  it("charges continuously at 10 percentage points per simulated minute", () => {
    expect(calculateChargePercentage(20, 30_000)).toBe(25)
    expect(calculateChargePercentage(20, 3 * MILLISECONDS_PER_MINUTE)).toBe(50)
  })

  it("keeps charge within the 0 to 100 range", () => {
    expect(calculateChargePercentage(-20, 0)).toBe(0)
    expect(calculateChargePercentage(120, 0)).toBe(100)
    expect(calculateChargePercentage(95, MILLISECONDS_PER_MINUTE)).toBe(100)
  })

  it("floors fractional percentage points for the integer database field", () => {
    expect(calculateChargePercentage(20, 1_000)).toBe(20)
    expect(calculateChargePercentage(20, 6_000)).toBe(21)
  })

  it("applies the simulation clock to charging without a scheduler", () => {
    expect(
      calculateChargingPercentageAt(
        20,
        {
          accumulatedSimulatedMilliseconds: 0,
          anchorAt: startedAt,
          timeScale: 2,
        },
        new Date("2026-11-08T00:02:00.000Z"),
      ),
    ).toBe(60)
  })

  it("rejects invalid timestamps, negative elapsed time, and invalid scales", () => {
    expect(() => calculateElapsedMilliseconds("invalid", startedAt)).toThrow(
      "startedAt must be a valid timestamp.",
    )
    expect(() =>
      calculateElapsedMilliseconds(
        startedAt,
        new Date("2026-11-07T23:59:59.999Z"),
      ),
    ).toThrow("now must not be earlier than startedAt.")
    expect(() =>
      calculateSimulatedElapsedMilliseconds({
        accumulatedSimulatedMilliseconds: 0,
        anchorAt: startedAt,
        timeScale: 0,
      }),
    ).toThrow("timeScale must be a positive finite number.")
    expect(() => calculateChargePercentage(20, -1)).toThrow(
      "simulatedElapsedMilliseconds must be a non-negative finite number.",
    )
  })
})

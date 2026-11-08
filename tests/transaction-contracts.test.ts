import { describe, expect, it } from "vitest"

import { TRANSACTION_CONTRACTS } from "@/contracts/transactions"
import { canTransitionBatteryStatus } from "@/domain/battery-status"

describe("shared transaction contracts", () => {
  it("requires row locks for every future business transaction", () => {
    for (const contract of Object.values(TRANSACTION_CONTRACTS)) {
      expect(contract.locks.length).toBeGreaterThan(0)
      expect(contract.locks.some((lock) => lock.includes("FOR UPDATE"))).toBe(
        true,
      )
    }
  })

  it("requires an atomic history write for every battery mutation", () => {
    for (const contract of Object.values(TRANSACTION_CONTRACTS)) {
      expect(
        contract.atomicWrites.some((write) => write.includes("history")),
      ).toBe(true)
    }
  })

  it("keeps relocation and lifecycle contracts aligned with status rules", () => {
    expect(
      canTransitionBatteryStatus("Available", "Available", {
        relocation: true,
      }),
    ).toBe(true)
    expect(
      canTransitionBatteryStatus("Rented", "Rented", { relocation: true }),
    ).toBe(false)
    expect(canTransitionBatteryStatus("Disposed", "Charging")).toBe(false)
  })

  it("requires concurrency errors for multi-row rental operations", () => {
    expect(TRANSACTION_CONTRACTS.startRental.errors).toContain(
      "CONCURRENT_MODIFICATION",
    )
    expect(TRANSACTION_CONTRACTS.returnRental.errors).toContain(
      "CONCURRENT_MODIFICATION",
    )
  })
})

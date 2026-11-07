import { describe, expect, it } from "vitest"

import { BATTERY_STATUSES } from "@/domain/battery-status"
import { isActiveUnreturnedRental } from "@/domain/rentals"

describe("active unreturned rental", () => {
  it.each(["Rented", "Overdue"] as const)(
    "is active when return time is null and the battery is %s",
    (status) => {
      expect(isActiveUnreturnedRental({ returnTime: null }, status)).toBe(true)
    },
  )

  it.each(["Rented", "Overdue"] as const)(
    "is inactive after return even if the battery remains %s",
    (status) => {
      expect(
        isActiveUnreturnedRental(
          { returnTime: "2026-11-08T12:00:00.000Z" },
          status,
        ),
      ).toBe(false)
    },
  )

  it.each(
    BATTERY_STATUSES.filter(
      (status) => status !== "Rented" && status !== "Overdue",
    ),
  )("is inactive while the battery is %s", (status) => {
    expect(isActiveUnreturnedRental({ returnTime: null }, status)).toBe(false)
  })
})

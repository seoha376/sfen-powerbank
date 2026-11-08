import { describe, expect, it, vi } from "vitest"

import {
  loadTrustedDemoControl,
  resolveTrustedSimulationOutcome,
  type TrustedDemoControlSource,
} from "@/server/simulation-control"

function createSource(
  role: "user" | "administrator" | null,
  demoModeEnabled: boolean,
): TrustedDemoControlSource {
  return {
    getActorRole: vi.fn().mockResolvedValue(role),
    getDemoModeEnabled: vi.fn().mockResolvedValue(demoModeEnabled),
  }
}

describe("trusted simulation control", () => {
  it("builds the demo gate from server-owned role, setting, and environment", async () => {
    const source = createSource("administrator", true)

    await expect(
      loadTrustedDemoControl(source, "auth-admin", "true"),
    ).resolves.toEqual({
      isAdmin: true,
      demoModeEnabled: true,
      demoModeAllowed: true,
    })
    expect(source.getActorRole).toHaveBeenCalledWith("auth-admin")
  })

  it.each([
    ["user", true, "true"],
    ["administrator", false, "true"],
    ["administrator", true, "false"],
  ] as const)(
    "rejects a forced outcome when a trusted gate is closed",
    async (role, enabled, environmentValue) => {
      await expect(
        resolveTrustedSimulationOutcome({
          source: createSource(role, enabled),
          authUserId: "auth-user",
          event: "repair",
          forcedOutcome: "success",
          demoModeAllowedEnvironmentValue: environmentValue,
        }),
      ).rejects.toThrow(
        "requires an administrator with enabled and allowed demo mode",
      )
    },
  )

  it("allows an administrator to force a result when all trusted gates pass", async () => {
    await expect(
      resolveTrustedSimulationOutcome({
        source: createSource("administrator", true),
        authUserId: "auth-admin",
        event: "charging",
        forcedOutcome: "failure",
        random: () => 0.99,
        demoModeAllowedEnvironmentValue: "true",
      }),
    ).resolves.toBe("failure")
  })

  it("uses actual probability without querying demo authorization", async () => {
    const source = createSource(null, false)

    await expect(
      resolveTrustedSimulationOutcome({
        source,
        authUserId: "auth-user",
        event: "batteryUse",
        random: () => 0.01,
        demoModeAllowedEnvironmentValue: undefined,
      }),
    ).resolves.toBe("failure")
    expect(source.getActorRole).not.toHaveBeenCalled()
    expect(source.getDemoModeEnabled).not.toHaveBeenCalled()
  })
})

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  isDemoModeAllowedFromEnvironment,
  resolveSimulationOutcome,
  type DemoControl,
  type RandomSource,
  type SimulationEvent,
  type SimulationOutcomeMap,
} from "@/domain/probability"

export interface TrustedDemoControlSource {
  getActorRole(authUserId: string): Promise<"user" | "administrator" | null>
  getDemoModeEnabled(): Promise<boolean>
}

export class SupabaseDemoControlSource implements TrustedDemoControlSource {
  private readonly client: SupabaseClient

  constructor(serverClient: SupabaseClient) {
    this.client = serverClient
  }

  async getActorRole(authUserId: string) {
    const { data, error } = await this.client
      .from("app_users")
      .select("role")
      .eq("auth_user_id", authUserId)
      .maybeSingle()

    if (error) throw error
    return (data?.role as "user" | "administrator" | undefined) ?? null
  }

  async getDemoModeEnabled() {
    const { data, error } = await this.client
      .from("system_settings")
      .select("demo_mode_enabled")
      .eq("settings_id", 1)
      .single()

    if (error) throw error
    return data.demo_mode_enabled === true
  }
}

export async function loadTrustedDemoControl(
  source: TrustedDemoControlSource,
  authUserId: string,
  demoModeAllowedEnvironmentValue: string | undefined,
): Promise<DemoControl> {
  const [role, demoModeEnabled] = await Promise.all([
    source.getActorRole(authUserId),
    source.getDemoModeEnabled(),
  ])

  return {
    isAdmin: role === "administrator",
    demoModeEnabled,
    demoModeAllowed: isDemoModeAllowedFromEnvironment(
      demoModeAllowedEnvironmentValue,
    ),
  }
}

export async function resolveTrustedSimulationOutcome<
  Event extends SimulationEvent,
>(input: {
  readonly source: TrustedDemoControlSource
  readonly authUserId: string
  readonly event: Event
  readonly forcedOutcome?: SimulationOutcomeMap[Event]
  readonly random?: RandomSource
  readonly demoModeAllowedEnvironmentValue: string | undefined
}): Promise<SimulationOutcomeMap[Event]> {
  const demoControl =
    input.forcedOutcome === undefined
      ? undefined
      : await loadTrustedDemoControl(
          input.source,
          input.authUserId,
          input.demoModeAllowedEnvironmentValue,
        )

  return resolveSimulationOutcome(input.event, {
    random: input.random,
    forcedOutcome: input.forcedOutcome,
    demoControl,
  })
}

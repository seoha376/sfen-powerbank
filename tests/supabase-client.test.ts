import { beforeEach, describe, expect, it, vi } from "vitest"

describe("Supabase client boundary", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv("VITE_SUPABASE_URL", "")
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "")
  })

  it("defers configuration validation until the client is requested", async () => {
    const { getSupabaseClient } = await import("@/lib/supabase")

    expect(() => getSupabaseClient()).toThrow(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    )
  })
})

import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"

import {
  ensureAdministrator,
  type AdministratorBootstrapGateway,
  type BootstrapAuthUser,
} from "./lib/admin-bootstrap.ts"

function requireEnvironment(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`${name} is required.`)
  }

  return value
}

function toBootstrapAuthUser(user: User): BootstrapAuthUser {
  if (!user.email) {
    throw new Error(`Auth user ${user.id} does not have an email address.`)
  }

  return { id: user.id, email: user.email, appMetadata: user.app_metadata }
}

class SupabaseAdministratorGateway implements AdministratorBootstrapGateway {
  private readonly client: SupabaseClient

  constructor(client: SupabaseClient) {
    this.client = client
  }

  async getAppUser(userId: string) {
    const { data, error } = await this.client
      .from("app_users")
      .select("auth_user_id, role")
      .eq("user_id", userId)
      .maybeSingle()

    if (error) throw error
    if (!data) return null

    return { authUserId: data.auth_user_id, role: data.role }
  }

  async getAuthUserById(authUserId: string) {
    const { data, error } = await this.client.auth.admin.getUserById(authUserId)

    if (error?.status === 404) return null
    if (error) throw error

    return toBootstrapAuthUser(data.user)
  }

  async findAuthUserByEmail(email: string) {
    const pageSize = 1000

    for (let page = 1; ; page += 1) {
      const { data, error } = await this.client.auth.admin.listUsers({
        page,
        perPage: pageSize,
      })

      if (error) throw error

      const match = data.users.find(
        (user) => user.email?.toLowerCase() === email.toLowerCase(),
      )

      if (match) return toBootstrapAuthUser(match)
      if (data.users.length < pageSize) return null
    }
  }

  async createAuthUser(input: {
    email: string
    password: string
    userId: string
  }) {
    const { data, error } = await this.client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      app_metadata: {
        sfen_role: "administrator",
        sfen_user_id: input.userId,
      },
    })

    if (error) throw error

    return toBootstrapAuthUser(data.user)
  }

  async linkAdministrator(input: {
    userId: string
    userName: string
    authUserId: string
  }) {
    const { data: conflictingProfile, error: conflictError } = await this.client
      .from("app_users")
      .select("user_id")
      .eq("auth_user_id", input.authUserId)
      .neq("user_id", input.userId)
      .maybeSingle()

    if (conflictError) throw conflictError
    if (conflictingProfile) {
      throw new Error("The Auth user is already linked to another app user.")
    }

    const { error } = await this.client.from("app_users").upsert(
      {
        user_id: input.userId,
        user_name: input.userName,
        role: "administrator",
        auth_user_id: input.authUserId,
      },
      { onConflict: "user_id" },
    )

    if (error) throw error
  }
}

async function main(): Promise<void> {
  const supabaseUrl = requireEnvironment("SUPABASE_URL")
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    requireEnvironment("SUPABASE_SERVICE_ROLE_KEY")

  const client = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const result = await ensureAdministrator(
    new SupabaseAdministratorGateway(client),
    {
      userId: requireEnvironment("SFEN_ADMIN_ID"),
      userName: requireEnvironment("SFEN_ADMIN_NAME"),
      email: requireEnvironment("SFEN_ADMIN_EMAIL"),
      password: requireEnvironment("SFEN_ADMIN_PASSWORD"),
    },
  )

  console.info(
    result.created
      ? `Administrator initialized (${result.authUserId}).`
      : `Administrator already initialized (${result.authUserId}).`,
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

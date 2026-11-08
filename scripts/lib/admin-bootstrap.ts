export interface BootstrapAuthUser {
  readonly id: string
  readonly email: string
  readonly appMetadata: Record<string, unknown>
}

export interface ExistingAdministrator {
  readonly authUserId: string | null
  readonly role: string
}

export interface AdministratorBootstrapGateway {
  getAppUser(userId: string): Promise<ExistingAdministrator | null>
  getAuthUserById(authUserId: string): Promise<BootstrapAuthUser | null>
  findAuthUserByEmail(email: string): Promise<BootstrapAuthUser | null>
  createAuthUser(input: {
    email: string
    password: string
    userId: string
  }): Promise<BootstrapAuthUser>
  linkAdministrator(input: {
    userId: string
    userName: string
    authUserId: string
  }): Promise<void>
}

export interface AdministratorBootstrapInput {
  readonly userId: string
  readonly userName: string
  readonly email: string
  readonly password: string
}

export interface AdministratorBootstrapResult {
  readonly authUserId: string
  readonly created: boolean
}

function validateInput(input: AdministratorBootstrapInput): void {
  if (!input.userId.trim()) {
    throw new Error("SFEN_ADMIN_ID is required.")
  }

  if (/^\d{8}$/.test(input.userId.trim())) {
    throw new Error("SFEN_ADMIN_ID must not use the eight-digit student ID format.")
  }

  if (!input.userName.trim()) {
    throw new Error("SFEN_ADMIN_NAME is required.")
  }

  if (!/^\S+@\S+\.\S+$/.test(input.email)) {
    throw new Error("SFEN_ADMIN_EMAIL must be a valid email address.")
  }

  if (input.password.length < 8) {
    throw new Error("SFEN_ADMIN_PASSWORD must contain at least eight characters.")
  }
}

export async function ensureAdministrator(
  gateway: AdministratorBootstrapGateway,
  input: AdministratorBootstrapInput,
): Promise<AdministratorBootstrapResult> {
  validateInput(input)

  const userId = input.userId.trim()
  const userName = input.userName.trim()
  const email = input.email.trim().toLowerCase()
  const existingProfile = await gateway.getAppUser(userId)

  if (existingProfile && existingProfile.role !== "administrator") {
    throw new Error(`User ID ${userId} already belongs to a non-administrator.`)
  }

  if (existingProfile?.authUserId) {
    const authUser = await gateway.getAuthUserById(existingProfile.authUserId)

    if (!authUser) {
      throw new Error("The administrator profile references a missing Auth user.")
    }

    return { authUserId: authUser.id, created: false }
  }

  let authUser = await gateway.findAuthUserByEmail(email)
  let created = false

  if (!authUser) {
    authUser = await gateway.createAuthUser({
      email,
      password: input.password,
      userId,
    })
    created = true
  } else if (
    authUser.appMetadata.sfen_role !== "administrator" ||
    authUser.appMetadata.sfen_user_id !== userId
  ) {
    throw new Error(
      "The administrator email belongs to an Auth user that was not created for this administrator ID.",
    )
  }

  await gateway.linkAdministrator({
    userId,
    userName,
    authUserId: authUser.id,
  })

  return { authUserId: authUser.id, created }
}

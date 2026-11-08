import { describe, expect, it } from "vitest"

import {
  ensureAdministrator,
  type AdministratorBootstrapGateway,
  type BootstrapAuthUser,
  type ExistingAdministrator,
} from "../scripts/lib/admin-bootstrap"

class FakeAdministratorGateway implements AdministratorBootstrapGateway {
  readonly appUsers = new Map<string, ExistingAdministrator>()
  readonly authUsers = new Map<string, BootstrapAuthUser>()
  createCount = 0

  async getAppUser(userId: string) {
    return this.appUsers.get(userId) ?? null
  }

  async getAuthUserById(authUserId: string) {
    return this.authUsers.get(authUserId) ?? null
  }

  async findAuthUserByEmail(email: string) {
    return (
      [...this.authUsers.values()].find((user) => user.email === email) ?? null
    )
  }

  async createAuthUser(input: { email: string; userId: string }) {
    this.createCount += 1
    const user = {
      id: `auth-${this.createCount}`,
      email: input.email,
      appMetadata: {
        sfen_role: "administrator",
        sfen_user_id: input.userId,
      },
    }
    this.authUsers.set(user.id, user)
    return user
  }

  async linkAdministrator(input: {
    userId: string
    authUserId: string
  }) {
    this.appUsers.set(input.userId, {
      authUserId: input.authUserId,
      role: "administrator",
    })
  }
}

const input = {
  userId: "admin-root",
  userName: "System Administrator",
  email: "admin@example.com",
  password: "strong-password",
} as const

describe("administrator bootstrap", () => {
  it("creates and links the administrator once across repeated runs", async () => {
    const gateway = new FakeAdministratorGateway()

    const first = await ensureAdministrator(gateway, input)
    const second = await ensureAdministrator(gateway, input)

    expect(first).toEqual({ authUserId: "auth-1", created: true })
    expect(second).toEqual({ authUserId: "auth-1", created: false })
    expect(gateway.createCount).toBe(1)
  })

  it("links an existing Auth email without creating a duplicate", async () => {
    const gateway = new FakeAdministratorGateway()
    gateway.authUsers.set("existing-auth", {
      id: "existing-auth",
      email: input.email,
      appMetadata: {
        sfen_role: "administrator",
        sfen_user_id: input.userId,
      },
    })

    const result = await ensureAdministrator(gateway, input)

    expect(result).toEqual({ authUserId: "existing-auth", created: false })
    expect(gateway.createCount).toBe(0)
  })

  it("refuses to promote an unrelated existing Auth email", async () => {
    const gateway = new FakeAdministratorGateway()
    gateway.authUsers.set("unrelated-auth", {
      id: "unrelated-auth",
      email: input.email,
      appMetadata: {},
    })

    await expect(ensureAdministrator(gateway, input)).rejects.toThrow(
      "was not created for this administrator ID",
    )
    expect(gateway.appUsers.has(input.userId)).toBe(false)
  })

  it("does not promote an existing non-administrator profile", async () => {
    const gateway = new FakeAdministratorGateway()
    gateway.appUsers.set(input.userId, { authUserId: null, role: "user" })

    await expect(ensureAdministrator(gateway, input)).rejects.toThrow(
      "already belongs to a non-administrator",
    )
  })

  it("rejects an administrator ID that looks like a student ID", async () => {
    const gateway = new FakeAdministratorGateway()

    await expect(
      ensureAdministrator(gateway, { ...input, userId: "20260001" }),
    ).rejects.toThrow("must not use the eight-digit student ID format")
  })
})

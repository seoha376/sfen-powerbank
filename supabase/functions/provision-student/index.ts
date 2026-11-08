import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

import {
  normalizeStudentId,
  studentIdToInternalEmail,
} from "../_shared/student-identity.ts"

interface ProvisionStudentRequest {
  readonly studentId?: unknown
  readonly userName?: unknown
  readonly password?: unknown
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}

function requireRequestValue(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`)
  }

  return value.trim()
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." })
  }

  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse(401, { error: "Authentication is required." })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Server authentication is not configured." })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const token = authorization.slice("Bearer ".length)
  const {
    data: { user: caller },
    error: callerError,
  } = await adminClient.auth.getUser(token)

  if (callerError || !caller) {
    return jsonResponse(401, { error: "The access token is invalid." })
  }

  const { data: administrator, error: administratorError } = await adminClient
    .from("app_users")
    .select("user_id")
    .eq("auth_user_id", caller.id)
    .eq("role", "administrator")
    .maybeSingle()

  if (administratorError) {
    return jsonResponse(500, { error: "Administrator access could not be verified." })
  }

  if (!administrator) {
    return jsonResponse(403, { error: "Administrator access is required." })
  }

  let payload: ProvisionStudentRequest

  try {
    payload = await request.json()
  } catch {
    return jsonResponse(400, { error: "A JSON request body is required." })
  }

  let studentId: string
  let userName: string
  let password: string

  try {
    studentId = normalizeStudentId(requireRequestValue(payload.studentId, "studentId"))
    userName = requireRequestValue(payload.userName, "userName")
    password = requireRequestValue(payload.password, "password")

    if (password.length < 8) {
      throw new Error("password must contain at least eight characters.")
    }
  } catch (error) {
    return jsonResponse(400, {
      error: error instanceof Error ? error.message : "The request is invalid.",
    })
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("app_users")
    .select("auth_user_id, role")
    .eq("user_id", studentId)
    .maybeSingle()

  if (existingProfileError) {
    return jsonResponse(500, { error: "The student profile could not be checked." })
  }

  if (existingProfile?.role === "administrator" || existingProfile?.auth_user_id) {
    return jsonResponse(409, { error: "The student account already exists." })
  }

  const email = studentIdToInternalEmail(studentId)
  const { data: authData, error: createError } =
    await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { sfen_role: "user", sfen_user_id: studentId },
    })

  if (createError) {
    return jsonResponse(409, { error: "The student Auth account could not be created." })
  }

  const profileWrite = existingProfile
    ? adminClient
        .from("app_users")
        .update({ auth_user_id: authData.user.id })
        .eq("user_id", studentId)
        .is("auth_user_id", null)
        .select("auth_user_id")
        .maybeSingle()
    : adminClient.from("app_users").insert({
        user_id: studentId,
        auth_user_id: authData.user.id,
        user_name: userName,
        role: "user",
      }).select("auth_user_id").single()
  const { data: linkedProfile, error: profileError } = await profileWrite

  if (profileError || linkedProfile?.auth_user_id !== authData.user.id) {
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return jsonResponse(existingProfile ? 409 : 500, {
      error: "The student profile could not be linked.",
    })
  }

  return jsonResponse(201, {
    userId: studentId,
    authUserId: authData.user.id,
  })
})

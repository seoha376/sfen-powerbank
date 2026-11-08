import type { AuthTokenResponsePassword, SupabaseClient } from "@supabase/supabase-js"

import {
  isValidStudentId,
  normalizeStudentId,
  STUDENT_AUTH_EMAIL_DOMAIN,
  STUDENT_ID_PATTERN,
  studentIdToInternalEmail,
} from "../../supabase/functions/_shared/student-identity"
import { getSupabaseClient } from "@/lib/supabase"

export {
  isValidStudentId,
  normalizeStudentId,
  STUDENT_AUTH_EMAIL_DOMAIN,
  STUDENT_ID_PATTERN,
  studentIdToInternalEmail,
}

export interface StudentSignInCredentials {
  readonly studentId: string
  readonly password: string
}

export interface AppUserProfile {
  readonly userId: string
  readonly authUserId: string
  readonly userName: string
  readonly role: "user" | "administrator"
  readonly userStatus: "Enrolled" | "Graduated" | null
  readonly approvalStatus: "Pending" | "Approved" | "Rejected" | null
  readonly eligibilityStatus: boolean
  readonly suspensionType: "none" | "temporary" | "permanent"
  readonly suspendedUntil: string | null
  readonly graduationYear: number | null
  readonly certificateFile: string | null
}

export async function signInWithStudentId(
  credentials: StudentSignInCredentials,
  client: SupabaseClient = getSupabaseClient(),
): Promise<AuthTokenResponsePassword["data"]> {
  const { data, error } = await client.auth.signInWithPassword({
    email: studentIdToInternalEmail(credentials.studentId),
    password: credentials.password,
  })

  if (error) {
    throw error
  }

  return data
}

export async function getCurrentAppUser(
  client: SupabaseClient = getSupabaseClient(),
): Promise<AppUserProfile> {
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser()

  if (authError) {
    throw authError
  }

  if (!user) {
    throw new Error("No authenticated user is available.")
  }

  const { data, error } = await client
    .from("app_users")
    .select(
      "user_id, auth_user_id, user_name, role, user_status, approval_status, eligibility_status, suspension_type, suspended_until, graduation_year, certificate_file",
    )
    .eq("auth_user_id", user.id)
    .single()

  if (error) {
    throw error
  }

  return {
    userId: data.user_id,
    authUserId: data.auth_user_id,
    userName: data.user_name,
    role: data.role,
    userStatus: data.user_status,
    approvalStatus: data.approval_status,
    eligibilityStatus: data.eligibility_status,
    suspensionType: data.suspension_type,
    suspendedUntil: data.suspended_until,
    graduationYear: data.graduation_year,
    certificateFile: data.certificate_file,
  } as AppUserProfile
}

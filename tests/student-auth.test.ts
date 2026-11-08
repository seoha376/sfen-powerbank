import type { SupabaseClient } from "@supabase/supabase-js"
import { describe, expect, it, vi } from "vitest"

import {
  isValidStudentId,
  normalizeStudentId,
  signInWithStudentId,
  studentIdToInternalEmail,
} from "@/auth/student-auth"

describe("student authentication identity", () => {
  it.each(["20260001", "00000000", "99999999"])(
    "accepts the eight-digit student ID %s",
    (studentId) => {
      expect(isValidStudentId(studentId)).toBe(true)
      expect(normalizeStudentId(studentId)).toBe(studentId)
    },
  )

  it.each(["", "2026001", "202600001", "2026A001", "admin-root"])(
    "rejects the invalid student ID %s",
    (studentId) => {
      expect(isValidStudentId(studentId)).toBe(false)
      expect(() => normalizeStudentId(studentId)).toThrow(
        "Student ID must contain exactly eight digits.",
      )
    },
  )

  it("normalizes surrounding whitespace before validation", () => {
    expect(normalizeStudentId(" 20260001 ")).toBe("20260001")
  })

  it("maps a student ID to the single internal email format", () => {
    expect(studentIdToInternalEmail("20260001")).toBe(
      "20260001@students.sfen.invalid",
    )
  })

  it("uses Supabase password authentication with the internal email", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "auth-user-id" }, session: null },
      error: null,
    })
    const client = {
      auth: { signInWithPassword },
    } as unknown as SupabaseClient

    await signInWithStudentId(
      { studentId: "20260001", password: "student-secret" },
      client,
    )

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "20260001@students.sfen.invalid",
      password: "student-secret",
    })
  })
})

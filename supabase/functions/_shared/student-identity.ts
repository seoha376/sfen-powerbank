export const STUDENT_ID_PATTERN = /^\d{8}$/
export const STUDENT_AUTH_EMAIL_DOMAIN = "students.sfen.invalid"

export function normalizeStudentId(value: string): string {
  const studentId = value.trim()

  if (!STUDENT_ID_PATTERN.test(studentId)) {
    throw new Error("Student ID must contain exactly eight digits.")
  }

  return studentId
}

export function isValidStudentId(value: string): boolean {
  try {
    normalizeStudentId(value)
    return true
  } catch {
    return false
  }
}

export function studentIdToInternalEmail(value: string): string {
  return `${normalizeStudentId(value)}@${STUDENT_AUTH_EMAIL_DOMAIN}`
}

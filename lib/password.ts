/**
 * The strength bar under password fields (mocks 05, 06, 11). The backend's
 * rule is the real one: at least 12 characters, at most 72 bytes, not the
 * email (PasswordPolicy). This only guides the person while typing.
 */
export const MIN_PASSWORD = 12

export type Strength = { level: 0 | 1 | 2 | 3 | 4; hint: string }

export function strength(password: string): Strength {
  if (!password) return { level: 0, hint: `At least ${MIN_PASSWORD} characters.` }
  const length = [...password].length
  if (length < MIN_PASSWORD) return { level: 1, hint: `Too short. Use at least ${MIN_PASSWORD} characters.` }
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  const words = password.split(/[\s\-_.]+/).filter(Boolean).length
  const score = (length >= 16 ? 2 : 1) + (kinds >= 3 ? 1 : 0) + (words >= 3 || length >= 20 ? 1 : 0)
  if (score >= 3) return { level: 4, hint: "Strong password." }
  if (score === 2) return { level: 3, hint: "Good. Adding a symbol or another word makes it strong." }
  return { level: 2, hint: "Fair. Make it longer or add another word." }
}

export function tooLong(password: string): boolean {
  return new TextEncoder().encode(password).length > 72
}

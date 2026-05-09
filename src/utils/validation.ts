/**
 * Attenza — shared input validation
 * All functions return { valid: boolean; error?: string }
 */

export interface ValidationResult {
  valid: boolean
  error?: string
}

const ok = (): ValidationResult => ({ valid: true })
const err = (msg: string): ValidationResult => ({ valid: false, error: msg })

// ─── Name ─────────────────────────────────────────────────────

/**
 * Full name: 2–80 chars, letters/spaces/dots/hyphens only
 */
export function validateName(raw: string): ValidationResult {
  const v = raw.trim()
  if (!v) return err('Name is required.')
  if (v.length < 2) return err('Name must be at least 2 characters.')
  if (v.length > 80) return err('Name must be under 80 characters.')
  if (!/^[A-Za-z\s.\-']+$/.test(v))
    return err('Name can only contain letters, spaces, dots or hyphens.')
  return ok()
}

// ─── Roll number ──────────────────────────────────────────────

const ROLL_RE = /^[A-Z0-9]{5,15}$/

/**
 * Single roll number: 5–15 alphanumeric characters (uppercase).
 */
export function validateRollNumber(raw: string): ValidationResult {
  const v = raw.trim().toUpperCase()
  if (!v) return err('Roll number is required.')
  if (!ROLL_RE.test(v))
    return err('Roll number must be 5–15 uppercase letters/digits (e.g. 25ECE04131).')
  return ok()
}

/**
 * Roll range: validates both rolls individually, then checks that
 * they share the same alphabetical prefix and start ≤ end.
 */
export function validateRollRange(
  startRaw: string,
  endRaw: string
): ValidationResult {
  const start = startRaw.trim().toUpperCase()
  const end = endRaw.trim().toUpperCase()

  const sv = validateRollNumber(start)
  if (!sv.valid) return err(`Start roll: ${sv.error}`)

  const ev = validateRollNumber(end)
  if (!ev.valid) return err(`End roll: ${ev.error}`)

  // Prefix must match (e.g. both start with "25ECE04")
  const prefix = (r: string) => r.replace(/\d+$/, '')
  const suffix = (r: string) => parseInt(r.match(/(\d+)$/)![1], 10)

  if (prefix(start) !== prefix(end))
    return err('Start and end roll numbers must share the same prefix (e.g. both 25ECE04…).')

  if (suffix(start) > suffix(end))
    return err('Start roll must be less than or equal to end roll.')

  const count = suffix(end) - suffix(start) + 1
  if (count > 200)
    return err(`Range covers ${count} students — maximum allowed is 200.`)

  return ok()
}

// ─── Mobile ───────────────────────────────────────────────────

/**
 * Mobile: empty (optional) or exactly 10 digits.
 */
export function validateMobile(raw: string | null | undefined): ValidationResult {
  if (!raw) return ok() // optional
  const v = raw.trim()
  if (!v) return ok()   // optional
  if (!/^\d{10}$/.test(v))
    return err('Mobile number must be exactly 10 digits.')
  return ok()
}

// ─── Subject / Faculty name ───────────────────────────────────

/**
 * General text field: 2–100 printable characters.
 */
export function validateTextField(
  raw: string,
  fieldName: string,
  opts: { min?: number; max?: number } = {}
): ValidationResult {
  const min = opts.min ?? 2
  const max = opts.max ?? 100
  const v = raw.trim()
  if (!v) return err(`${fieldName} is required.`)
  if (v.length < min) return err(`${fieldName} must be at least ${min} characters.`)
  if (v.length > max) return err(`${fieldName} must be under ${max} characters.`)
  // Reject control characters and common SQL meta characters
  if (/[\x00-\x1F\x7F]/.test(v))
    return err(`${fieldName} contains invalid characters.`)
  return ok()
}

// ─── Convenience: alert-on-fail ───────────────────────────────

import { Alert } from 'react-native'

/**
 * Runs validation, shows Alert if invalid, returns boolean.
 * Use in handleSubmit to keep screens clean:
 *
 *   if (!check(validateName(name))) return
 */
export function check(result: ValidationResult): boolean {
  if (!result.valid) {
    Alert.alert('Invalid Input', result.error ?? 'Please check your input.')
    return false
  }
  return true
}

// ─── College Email ───────────────────────────────────────────

const ALLOWED_EMAIL_DOMAINS = ['svce.edu.in']

export function isValidEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim().toLowerCase())
}

export function getEmailDomain(raw: string): string {
  const email = raw.trim().toLowerCase()
  const parts = email.split('@')
  return parts.length === 2 ? parts[1] : ''
}

export function isAllowedCollegeEmail(raw: string): boolean {
  const domain = getEmailDomain(raw)
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain)
}

export function validateCollegeEmail(raw: string): ValidationResult {
  const email = raw.trim().toLowerCase()

  if (!email) return err('Email is required.')
  if (!isValidEmail(email)) return err('Please enter a valid email address.')
  if (!isAllowedCollegeEmail(email)) {
    return err('Only @svce.edu.in email addresses are allowed.')
  }

  return ok()
}
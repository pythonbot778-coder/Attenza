/**
 * Extracts the numeric suffix from a roll number
 * e.g., "25BFA04131" → 131
 */
export function getRollSuffix(roll: string): number {
  const match = roll.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

/**
 * Gets the roll prefix (everything before the numeric suffix)
 * e.g., "25BFA04131" → "25BFA04"
 */
export function getRollPrefix(roll: string): string {
  return roll.replace(/\d+$/, '')
}

/**
 * Generates all roll numbers between start and end (inclusive)
 * e.g., ("25BFA04131", "25BFA04135") → ["25BFA04131", ..., "25BFA04135"]
 */
export function generateRollRange(startRoll: string, endRoll: string): string[] {
  const prefix = getRollPrefix(startRoll)
  const start  = getRollSuffix(startRoll)
  const end    = getRollSuffix(endRoll)

  if (start > end) return []

  const rolls: string[] = []
  for (let i = start; i <= end; i++) {
    // Pad to same length as original suffix
    const originalLen = startRoll.replace(prefix, '').length
    const padded = String(i).padStart(originalLen, '0')
    rolls.push(`${prefix}${padded}`)
  }
  return rolls
}

/**
 * Checks if a roll number is within the class range
 */
export function isRollInRange(roll: string, startRoll: string, endRoll: string): boolean {
  const rollNum  = getRollSuffix(roll)
  const startNum = getRollSuffix(startRoll)
  const endNum   = getRollSuffix(endRoll)
  const rollPrefix  = getRollPrefix(roll)
  const startPrefix = getRollPrefix(startRoll)
  return rollPrefix === startPrefix && rollNum >= startNum && rollNum <= endNum
}

/**
 * Gets last 3 digits of roll number for attendance grid display
 * e.g., "25BFA04131" → "131"
 */
export function getDisplayRoll(roll: string): string {
  return roll.slice(-3)
}

/**
 * Checks if a roll is within a specific lab batch range
 */
export function isRollInBatch(roll: string, batchStart: string, batchEnd: string): boolean {
  return isRollInRange(roll, batchStart, batchEnd)
}
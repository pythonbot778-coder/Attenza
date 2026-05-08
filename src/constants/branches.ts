export const BRANCHES = ['CSE', 'ECE', 'EEE','CSM', 'CS','MECH', 'CSD', 'CIVIL'] as const

export type Branch = typeof BRANCHES[number]

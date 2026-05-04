export const BRANCHES = ['CSE', 'ECE', 'ME', 'CE', 'EEE', 'BTech'] as const

export type Branch = typeof BRANCHES[number]

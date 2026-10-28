export type RecordValue = Record<string, unknown>

export const object = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value)

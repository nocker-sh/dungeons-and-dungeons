export const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

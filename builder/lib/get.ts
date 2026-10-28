export function get(root: unknown, path: readonly string[]): unknown {
  let value = root
  for (const key of path) {
    if (value === null || typeof value !== "object") return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

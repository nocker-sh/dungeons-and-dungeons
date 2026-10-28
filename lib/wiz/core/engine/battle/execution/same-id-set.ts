export function sameIdSet(
  left: readonly string[],
  right: readonly string[]
): boolean {
  if (left.length !== right.length) return false
  return left.every((id) => right.includes(id))
}

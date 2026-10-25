/** id で引ける表にする。重複した id は誤りとして集める。 */
export function byId<T extends { readonly id: string }>(
  list: readonly T[],
  kind: string,
  problems: string[]
) {
  const map = new Map<string, T>()
  for (const entry of list) {
    if (map.has(entry.id)) problems.push(`${kind} の id が重複: ${entry.id}`)
    map.set(entry.id, entry)
  }
  return map
}

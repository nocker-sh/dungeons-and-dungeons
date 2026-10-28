/** 連番のID。既定は `id-1`, `id-2`, …。 */
export function sequentialIds(prefix = "id") {
  let serial = 0
  return () => `${prefix}-${++serial}`
}

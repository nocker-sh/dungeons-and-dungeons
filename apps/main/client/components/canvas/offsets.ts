import type { Frame } from "@/client/components/canvas/play"

/** offset の無いキーフレームに、Element.animate と同じ規則で位置を配る。 */
export function offsets(frames: readonly Frame[]) {
  const result = frames.map((frame) => frame.offset)
  if (result[0] === undefined) result[0] = frames.length > 1 ? 0 : 1
  if (result[result.length - 1] === undefined) result[result.length - 1] = 1
  let start = 0
  for (let i = 1; i < result.length; i++) {
    if (result[i] === undefined) continue
    const from = result[start]!
    const to = result[i]!
    for (let k = start + 1; k < i; k++)
      result[k] = from + ((to - from) * (k - start)) / (i - start)
    start = i
  }
  return result as number[]
}

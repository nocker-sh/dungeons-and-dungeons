import { TARGETS } from "@/builder/targets"
import type { CliOptions } from "@/builder/cli/options"

/** --targets id,id で測る目標を絞る。 */
export function chooseTargets(options: CliOptions, ids?: readonly string[]) {
  const wanted = options.targetIds?.length ? options.targetIds : ids
  if (!wanted?.length) return TARGETS
  return wanted.map((id) => {
    const target = TARGETS.find((entry) => entry.id === id)
    if (!target) throw new Error(`知らない目標: ${id}`)
    return target
  })
}

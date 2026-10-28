import type { StatusKind } from "@/lib/wiz/content/constants"
import type { Status } from "@/lib/wiz/state/state-schema"

/** 状態異常と強化の付け外し。 */
export class Statuses {
  static has(list: readonly Status[], kind: StatusKind) {
    return list.some((entry) => entry.kind === kind)
  }

  /** かけ直すと残りの手番を長い方にそろえる。 */
  static add(
    list: readonly Status[],
    kind: StatusKind,
    turns: number
  ): Status[] {
    const found = list.find((entry) => entry.kind === kind)
    if (!found) return [...list.map((entry) => ({ ...entry })), { kind, turns }]
    return list.map((entry) =>
      entry.kind === kind
        ? { kind, turns: Math.max(entry.turns, turns) }
        : { ...entry }
    )
  }

  static remove(
    list: readonly Status[],
    kinds: readonly StatusKind[]
  ): Status[] {
    return list
      .filter((entry) => !kinds.includes(entry.kind))
      .map((entry) => ({ ...entry }))
  }

  /** 手番を一つ終えたときに残りを減らす。charge と protect は使うまで残る。 */
  static tick(list: readonly Status[]): Status[] {
    return list
      .map((entry) =>
        entry.kind === "charge" || entry.kind === "protect"
          ? { ...entry }
          : { ...entry, turns: entry.turns - 1 }
      )
      .filter((entry) => entry.turns > 0)
  }
}

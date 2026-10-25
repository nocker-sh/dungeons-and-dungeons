import type { GameCommandError } from "@/lib/wiz/game"
import type { GameEvent } from "@/lib/wiz/state"

/** 成功した操作の出来事だけを取り出す。断られていたらその場で投げる。 */
export function eventsOrThrow(
  result: readonly GameEvent[] | GameCommandError
): readonly GameEvent[] {
  if (result instanceof Error) throw result
  return result
}

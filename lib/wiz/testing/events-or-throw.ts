import type { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameEvent } from "@/lib/wiz/state/game-event"

/** 成功した操作の出来事だけを取り出す。断られていたらその場で投げる。 */
export function eventsOrThrow(
  result: readonly GameEvent[] | GameCommandError
): readonly GameEvent[] {
  if (result instanceof Error) throw result
  return result
}

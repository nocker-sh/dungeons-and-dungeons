import type { z } from "zod"
import { WizWorldModule } from "@/lib/wiz/core/world/world"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameReason } from "@/lib/wiz/state/game-reason"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { Operation } from "@/lib/wiz/application/operation"

/** 操作の schema とユースケースを、core の World のモジュールにする。 */
export function moduleFor<TSchema extends z.ZodType>(
  name: string,
  schema: TSchema,
  operation: Operation<WizDeepReadonly<z.output<TSchema>>>
) {
  // 種類（type）が違う操作は、スキーマを通さずに先に外す。
  // 全モジュールのスキーマで失敗を作ると一手ごとの処理が重くなるため。
  return WizWorldModule.define<
    GameState,
    WizDeepReadonly<z.output<TSchema>>,
    GameEvent,
    GameReason
  >({
    name,
    accepts: (action): action is WizDeepReadonly<z.output<TSchema>> =>
      typeof action === "object" &&
      action !== null &&
      (action as { type?: unknown }).type === name &&
      schema.safeParse(action).success,
    reduce: (state, input, environment) =>
      state.conversation?.active && name !== "finish-conversation"
        ? { accepted: false as const, reason: "PENDING" as const }
        : operation.execute(
            state as GameState,
            input as WizDeepReadonly<z.output<TSchema>>,
            environment
          ),
  })
}

import type { ConversationPhase } from "@/lib/wiz/phases/conversation-phase"
import type { GameCommandError } from "@/lib/wiz/game"
import type { GameEvent } from "@/lib/wiz/state"
import type { CreatingPhase } from "@/lib/wiz/phases/creating-phase"
import type { TownPhase } from "@/lib/wiz/phases/town-phase"
import type { ExpeditionPhase } from "@/lib/wiz/phases/expedition-phase"
import type { PendingPhase } from "@/lib/wiz/phases/pending-phase"
import type { MemberTurnPhase } from "@/lib/wiz/phases/member-turn-phase"
import type { FoeTurnPhase } from "@/lib/wiz/phases/foe-turn-phase"

/**
 * フェーズごとの操作を型で縛る有限オートマトン。
 *
 * - 今のフェーズは `phaseOf(game)` で得る。フェーズのクラスは、そのフェーズで押せる操作だけをメソッドに持つ。
 * - メソッドは成功すると `{ events, next }` を返す。`next` は次のフェーズで、型は行き先になりうるフェーズの和。
 * - 拒否されたら `GameCommandError`。フェーズを作った後に状態が進んでいれば `STALE` で拒否する（古いボタンからの操作）。
 * - 規則の検証はエンジン（各ユースケース）が必ず行う。ここは「どのフェーズで何を呼べるか」を型にするだけ。
 */
export type Step<Next extends Phase> =
  | Readonly<{ events: readonly GameEvent[]; next: Next }>
  | GameCommandError

export type Phase =
  | ConversationPhase
  | CreatingPhase
  | TownPhase
  | ExpeditionPhase
  | PendingPhase
  | MemberTurnPhase
  | FoeTurnPhase

/** 戦闘の一手のあと：次の手番、勝って戦利品の板、全滅して街。 */
export type AfterTurn =
  | MemberTurnPhase
  | FoeTurnPhase
  | PendingPhase
  | TownPhase
/** 地点に着いたあと：何もない地点、宝箱・罠の板、戦闘。 */
export type AfterAdvance =
  | ExpeditionPhase
  | PendingPhase
  | MemberTurnPhase
  | FoeTurnPhase

/** 戦闘の一手のあとに来るフェーズの名前。 */
export const AFTER_TURN = [
  "member-turn",
  "foe-turn",
  "pending",
  "town",
] as const

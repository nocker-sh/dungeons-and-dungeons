import type { Game } from "@/lib/wiz/game"
import type { GameState } from "@/lib/wiz/state"
import { PhaseBase, type PhaseResolver } from "@/lib/wiz/phases/phase-base"
import { AFTER_TURN, type AfterTurn } from "@/lib/wiz/phases/phase"

/** 仲間の手番：ワザ・防御・アイテム・殴る・ケイヤク。 */
export class MemberTurnPhase extends PhaseBase {
  readonly kind = "member-turn"

  constructor(
    game: Game,
    state: GameState,
    resolve: PhaseResolver,
    /** 手番の仲間。 */
    readonly actor: string
  ) {
    super(game, state, resolve)
  }

  /** 使える手が尽きたときの弱い攻撃。 */
  brawl(target?: string) {
    return this.send<AfterTurn>(
      { type: "act", command: "brawl", target },
      AFTER_TURN
    )
  }
  skill(skill: string, target?: string) {
    return this.send<AfterTurn>(
      { type: "act", command: "skill", skill, target },
      AFTER_TURN
    )
  }
  item(good: string, target?: string) {
    return this.send<AfterTurn>(
      { type: "act", command: "item", good, target },
      AFTER_TURN
    )
  }
  guard() {
    return this.send<AfterTurn>({ type: "act", command: "guard" }, AFTER_TURN)
  }
  /** ケイヤク：悪魔と契約して戦う仲間（R）がモードを変える。手番を使う。 */
  pact(mode: number) {
    return this.send<AfterTurn>(
      { type: "act", command: "pact", mode },
      AFTER_TURN
    )
  }
}

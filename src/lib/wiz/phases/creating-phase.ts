import { PhaseBase } from "@/lib/wiz/phases/phase-base"
import type { ConversationPhase } from "@/lib/wiz/phases/conversation-phase"
import type { TownPhase } from "@/lib/wiz/phases/town-phase"

/** 街へ着く前：開幕の場面を見て、野営を終えて街へ向かう。名前と容姿はギルドで登録する。 */
export class CreatingPhase extends PhaseBase {
  readonly kind = "creating"

  /** 開幕の場面を始める。見終えていれば断られる。 */
  startOpening() {
    return this.send<ConversationPhase>(
      { type: "start-conversation", trigger: "opening" },
      ["conversation"]
    )
  }

  /** 野営を終えて街へ着く（ギルドでの登録待ち）。 */
  leaveCamp() {
    return this.send<TownPhase>({ type: "leave-camp" }, ["town"])
  }

  /** 名前と外見をまとめて決めて街へ出る（場面の準備・CLI用）。 */
  createHero(name: string, look: string) {
    return this.send<TownPhase>({ type: "create-hero", name, look }, ["town"])
  }
}

import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { MagicSchool } from "@/lib/wiz/content/constants"
import type { GameState, Member } from "@/lib/wiz/state/state-schema"

/** 契約している悪魔と、仲間の魔法の流派。数値はCatalogから取得する。 */
export class PartyMagic {
  constructor(private readonly catalog: GameCatalog) {}

  /** 戦闘で呼ぶ悪魔と、そのレベル。まだ契約していなければ null。 */
  contracted(state: Pick<GameState, "demons" | "contract">) {
    if (!state.contract) return null
    const demon = this.catalog.demon(state.contract)
    if (!demon) return null
    const lv =
      state.demons.find((entry) => entry.id === state.contract)?.lv ?? 1
    return { demon, lv }
  }

  /** この仲間が使える魔法の流派。 */
  schoolsOf(member: Pick<Member, "id">): readonly MagicSchool[] {
    return this.catalog.member(member.id)?.schools ?? []
  }

  /** キャラ固有のスキル。 */
  skills(member: Pick<Member, "id">): readonly string[] {
    return this.catalog.member(member.id)?.skills ?? []
  }
}

import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { MagicSchool, StatusKind } from "@/lib/wiz/content/constants"
import type { GameState, Member } from "@/lib/wiz/state/state-schema"
import type { FusionBonus } from "./types"
const NO_FUSION: FusionBonus = { attack: 1, maxHp: 0, resist: {} }

/** 悪魔との合体・流派と相性。数値はCatalogから取得する。 */
export class PartyMagic {
  constructor(private readonly catalog: GameCatalog) {}

  /** 主人公のワザの威力の倍率。合体する悪魔のレベルで上がる。契約がなければ1。 */
  demonPower(state: Pick<GameState, "demons" | "contract">) {
    const lv = this.contracted(state)?.lv ?? 1
    return 1 + this.catalog.data.summon.powerPerLevel * (lv - 1)
  }

  /** 合体している悪魔と、そのレベル。まだ契約していなければ null（合体しないで戦う）。 */
  contracted(state: Pick<GameState, "demons" | "contract">) {
    if (!state.contract) return null
    const demon = this.catalog.demon(state.contract)
    if (!demon) return null
    const lv =
      state.demons.find((entry) => entry.id === state.contract)?.lv ?? 1
    return { demon, lv }
  }

  /** 合体している悪魔の魔法の流派。 */
  demonSchool(
    state: Pick<GameState, "demons" | "contract">
  ): MagicSchool | null {
    return this.contracted(state)?.demon.school ?? null
  }

  /**
   * 合体の効果。悪魔のレベル1つごとの分を掛け、主人公にだけ乗る。
   * ワザの威力の上がり方（`demonPower`）とは別の、素の強さへの加算。
   */
  fusionOf(
    member: Pick<Member, "id">,
    state: Pick<GameState, "demons" | "contract">
  ): FusionBonus {
    if (!this.catalog.member(member.id)?.hero) return NO_FUSION
    const contracted = this.contracted(state)
    const fusion = contracted?.demon.fusion
    if (!contracted || !fusion) return NO_FUSION
    const resist: Partial<Record<StatusKind, number>> = {}
    for (const [kind, value] of Object.entries(fusion.resist ?? {}))
      resist[kind as StatusKind] = Math.min(1, value * contracted.lv)
    return {
      attack: 1 + (fusion.attack ?? 0) * contracted.lv,
      maxHp: (fusion.maxHp ?? 0) * contracted.lv,
      resist,
    }
  }

  /** この仲間が使える魔法の流派。主人公は合体している悪魔の流派。 */
  schoolsOf(
    member: Pick<Member, "id">,
    state: Pick<GameState, "demons" | "contract">
  ): readonly MagicSchool[] {
    if (this.catalog.member(member.id)?.hero) {
      const school = this.demonSchool(state)
      return school ? [school] : []
    }
    return this.catalog.member(member.id)?.schools ?? []
  }

  /** 合体している悪魔と合う流派（相性）。合わなければ null。 */
  affinityOf(
    member: Pick<Member, "id">,
    state: Pick<GameState, "demons" | "contract">
  ): MagicSchool | null {
    const school = this.demonSchool(state)
    if (!school) return null
    return this.schoolsOf(member, state).includes(school) ? school : null
  }

  /**
   * 相性の倍率。合体している悪魔と流派が合う仲間は、その流派のワザの威力が上がる。
   * 武器から使う魔法も、持ち主にその流派があれば同じだけ上がる。
   */
  affinityFactor(
    member: Pick<Member, "id">,
    state: Pick<GameState, "demons" | "contract">,
    skillId: string
  ) {
    const school = this.catalog.skill(skillId)?.school
    if (!school) return 1
    return this.affinityOf(member, state) === school
      ? this.catalog.data.balance.school.affinity
      : 1
  }

  /** キャラ固有のスキル。主人公は契約している悪魔のワザ（契約がなければ持たない）。 */
  skills(
    member: Pick<Member, "id">,
    state: Pick<GameState, "contract">
  ): readonly string[] {
    if (this.catalog.member(member.id)?.hero)
      return state.contract
        ? (this.catalog.demon(state.contract)?.skills ?? [])
        : []
    return this.catalog.member(member.id)?.skills ?? []
  }
}

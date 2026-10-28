import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { SkillDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type {
  GameState,
  Member,
  WeaponIndividual,
} from "@/lib/wiz/state/state-schema"
import type { PartyEquipment } from "./equipment"
import type { PartyMagic } from "./magic"

/** 仲間のワザと使用回数。数値はCatalogから取得する。 */
export class PartySkills {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly equipment: PartyEquipment,
    private readonly magic: PartyMagic
  ) {}

  /**
   * そのワザを選べるか。流派の付いたキャラ固有のスキルは、その流派を使える仲間だけ。
   * 武器に付くワザは流派を問わず誰でも使える（魔法も武器から使う）。
   */
  canUseSchool(
    member: Pick<Member, "id">,
    state: Pick<GameState, "gear" | "demons" | "contract">,
    skillId: string
  ) {
    const school = this.catalog.skill(skillId)?.school
    if (this.catalog.skill(skillId)?.blessing) return true
    if (!school) return true
    if (this.weaponSkills(member, state).includes(skillId)) return true
    return this.magic.schoolsOf(member, state).includes(school)
  }

  /** 装備（または素）の武器に付く3つのワザ。個体ごとに変わる。 */
  weaponSkills(
    member: Pick<Member, "id"> & Partial<Pick<Member, "lv" | "mode">>,
    state: Pick<GameState, "gear">
  ): readonly string[] {
    return this.equipment.weaponOf(member, state)?.individual.skills ?? []
  }

  /** 武器3枠・祝福1枠と、別メニューのキャラ固有・悪魔スキル。 */
  battleSkills(
    member: Member,
    state: Pick<GameState, "gear" | "contract">
  ): readonly string[] {
    const weapon = this.weaponSkills(member, state)
    return [
      ...new Set([
        ...weapon,
        ...(member.blessing ? [member.blessing] : []),
        ...this.magic.skills(member, state),
      ]),
    ]
  }

  /** ワザそのものの最大の使用回数。null は無制限（敵のワザと「殴る」）。 */
  baseUses(skillId: string): number | null {
    return this.catalog.skill(skillId)?.uses ?? null
  }

  /** 武器の強化の段で増える使用回数。 */
  usesBonus(plus: number) {
    const per = this.catalog.data.balance.weapon.usesPerPlus
    return Math.floor(plus / per)
  }

  /**
   * いまのこの仲間にとっての最大の使用回数。null は無制限。
   * 装備している武器のワザは、強化の段だけ最大が増える（`balance.weapon.usesPerPlus`）。
   * R・SR の武器はさらにレア度の分だけ増える（`balance.weapon.rarity.uses`）。
   */
  maxUses(
    member: Pick<Member, "id"> & Partial<Pick<Member, "lv" | "mode">>,
    state: Pick<GameState, "gear">,
    skillId: string
  ): number | null {
    const base = this.baseUses(skillId)
    if (base === null) return null
    const weapon = this.equipment.weaponOf(member, state)
    if (!weapon?.equipped || !weapon.individual.skills.includes(skillId))
      return base
    return base + this.weaponUsesBonus(weapon.plus, weapon.individual.rarity)
  }

  /** 装備した武器のワザに足す使用回数：強化の段とレア度の分。 */
  weaponUsesBonus(plus: number, rarity: WeaponIndividual["rarity"]) {
    const table = this.catalog.data.balance.weapon.rarity.uses
    return this.usesBonus(plus) + (table[rarity] ?? 0)
  }

  /** そのワザを使った回数。 */
  usedOf(member: Pick<Member, "used">, skillId: string) {
    return member.used.find((entry) => entry.skill === skillId)?.count ?? 0
  }

  /** 残りの使用回数。null は無制限。 */
  leftOf(
    member: Pick<Member, "id" | "used">,
    state: Pick<GameState, "gear">,
    skillId: string
  ) {
    const max = this.maxUses(member, state, skillId)
    if (max === null) return null
    return Math.max(0, max - this.usedOf(member, skillId))
  }

  /** 一回使ったあとの記録。 */
  spendUse(member: Member, skillId: string): Member["used"] {
    if (this.baseUses(skillId) === null) return member.used
    const found = member.used.some((entry) => entry.skill === skillId)
    if (!found) return [...member.used, { skill: skillId, count: 1 }]
    return member.used.map((entry) =>
      entry.skill === skillId ? { ...entry, count: entry.count + 1 } : entry
    )
  }

  /** 使用回数を amount 回ずつ戻す。戻した回数の合計を返す。 */
  refillUses(member: Member, amount: number) {
    let restored = 0
    const used = member.used.flatMap((entry) => {
      const next = Math.max(0, entry.count - amount)
      restored += entry.count - next
      return next > 0 ? [{ skill: entry.skill, count: next }] : []
    })
    return { used, restored }
  }

  /** 攻撃できるワザが一つも残っていないと「殴る」が使える。 */
  canBrawl(member: Member, state: Pick<GameState, "gear" | "contract">) {
    return !this.battleSkills(member, state).some((id) => {
      const skill = this.catalog.skill(id)
      if (skill?.kind !== "hit") return false
      const left = this.leftOf(member, state, id)
      return left === null || left > 0
    })
  }

  /** 「殴る」のワザ。 */
  brawl(): WizDeepReadonly<SkillDef> | undefined {
    return this.catalog.skill(this.catalog.data.brawl)
  }
}

import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GoodDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { Bag } from "@/lib/wiz/rules/bag"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type {
  GameState,
  Stack,
  WeaponIndividual,
} from "@/lib/wiz/state/state-schema"
import { STAT_NAMES, WEAPON_TYPE_NAMES } from "@/lib/wiz/queries/names"

export type Good = WizDeepReadonly<GoodDef>

/** 品物・武器・防具の見え方。ほかの Query はここを通して同じ表示を作る。 */
export class GoodViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly rules: PartyRules,
    private readonly weapons: WeaponRules
  ) {}

  /**
   * ワザの名前と使用回数（誰のものでもない一覧用）。武器を渡すと、ランダムに入ったワザに印を付ける。
   * bonus は武器の強化で増える使用回数。
   */
  skillList(ids: readonly string[], good?: Good, bonus = 0) {
    return ids.flatMap((id, index) => {
      const skill = this.catalog.skill(id)
      if (!skill) return []
      return [
        {
          id: skill.id,
          name: skill.name,
          desc: skill.desc,
          uses: skill.uses === undefined ? null : skill.uses + bonus,
          kind: skill.kind,
          reach: skill.reach ?? null,
          /** この個体だけのワザ（武器の固定のワザではない）。 */
          random: !!good && this.weapons.isRandomSkill(good, index, id),
        },
      ]
    })
  }

  /** 店・生産で手に入る武器の基本の個体（N・上振れなし）。 */
  baseWeapon(good: Good) {
    return this.weapons.base(good)
  }

  entry<E extends object>(good: Good, extra: E) {
    return {
      id: good.id,
      name: good.name,
      kind: good.kind,
      desc: good.desc,
      stat: this.statText(good, 0),
      allowedJobs: good.allowedJobs ?? null,
      /** 武器なら武器種・攻撃力・必要な能力・付くワザ。 */
      weapon: this.weaponEntry(good, 0),
      ...extra,
    }
  }

  /** 品物の能力の表示。武器は攻撃力と必要な筋力・技量、防具は耐久から作る。 */
  statText(
    good: Good,
    plus: number,
    wear = 0,
    individual?: WeaponIndividual | null
  ): string {
    if (good.kind === "weapon") {
      const need = good.need ?? { str: 0, tec: 0 }
      const extraPower = individual?.extraPower ?? 0
      const parts = [
        WEAPON_TYPE_NAMES[good.weaponType!],
        `攻撃力 ${this.rules.equipment.weaponPower(good, plus, extraPower)}${
          extraPower ? `（上振れ +${extraPower}）` : ""
        }`,
      ]
      if (need.str) parts.push(`必要 筋力 ${need.str}`)
      if (need.tec) parts.push(`必要 技量 ${need.tec}`)
      return parts.join("　")
    }
    if (good.kind === "armor") {
      const max = this.rules.equipment.maxDurabilityOf(good, plus)
      const now = Math.max(0, max - wear)
      return [
        wear > 0 ? `耐久 ${now}/${max}` : `耐久 ${max}`,
        ...this.bonusText(good, plus),
      ].join("　")
    }
    if (!plus) return good.stat
    return this.bonusText(good, plus).join("　")
  }

  /** 装備の補正の表示（強化の段を含む）。 */
  bonusText(good: Good, plus: number) {
    const bonus = this.rules.equipment.gearBonus(good.bonus, plus)
    return (Object.keys(STAT_NAMES) as (keyof typeof STAT_NAMES)[])
      .filter((key) => bonus[key] !== 0)
      .map(
        (key) =>
          `${STAT_NAMES[key]} ${bonus[key] > 0 ? "+" : "−"}${Math.abs(bonus[key])}`
      )
  }

  /** 武器の中身（武器以外は null）。個体を渡すとレア度・上振れ・その個体のワザを出す。 */
  weaponEntry(good: Good, plus: number, individual?: WeaponIndividual | null) {
    if (good.kind !== "weapon") return null
    const need = good.need ?? { str: 0, tec: 0 }
    const weapon = individual ?? this.weapons.base(good)
    return {
      type: good.weaponType!,
      typeName: WEAPON_TYPE_NAMES[good.weaponType!],
      power: this.rules.equipment.weaponPower(good, plus, weapon.extraPower),
      need,
      /** 個体のレア度（N・R・SR）。 */
      rarity: weapon.rarity,
      /** 固定値より上振れしている攻撃力。 */
      extraPower: weapon.extraPower,
      /** 強化とレア度で増えるワザの使用回数。 */
      usesBonus: this.rules.skills.weaponUsesBonus(plus, weapon.rarity),
      skills: this.skillList(
        weapon.skills,
        good,
        this.rules.skills.weaponUsesBonus(plus, weapon.rarity)
      ),
    }
  }

  /** 強化の段つきの名前と能力の表示。防具は減った耐久、武器は個体の上振れも添える。 */
  gearLabel(
    good: Good,
    plus: number,
    wear = 0,
    individual?: WeaponIndividual | null
  ) {
    return {
      name: plus ? `${good.name}+${plus}` : good.name,
      stat: this.statText(good, plus, wear, individual),
      weapon: this.weaponEntry(good, plus, individual),
    }
  }

  /** 素材の不足を数える。 */
  materialNeeds(state: GameState, materials: readonly Stack[]) {
    // 支払いは同じ品物の各行を消費するため、表示と可否も合計数で判定する。
    return Bag.add([], materials).map((entry) => ({
      good: entry.good,
      name: this.catalog.good(entry.good)?.name ?? entry.good,
      count: entry.count,
      have: Bag.count(state.bag, entry.good),
    }))
  }
}

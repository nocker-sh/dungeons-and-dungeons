import {
  FIXED_WEAPON_SKILLS,
  WEAPON_SKILLS,
  rarities,
  type GameCatalog,
  type GoodDef,
  type Rarity,
} from "@/lib/wiz/content"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WeaponIndividual } from "@/lib/wiz/state"
import { drawWeighted, pickWeighted, type Random } from "@/lib/wiz/rules/random"

/** 装備している武器（または素の武器）。 */
export type EquippedWeapon = Readonly<{
  good: WizDeepReadonly<GoodDef>
  /** 鍛冶屋の強化の段。攻撃力に足す。 */
  plus: number
  /** 実際に装備しているか（false なら素の武器）。 */
  equipped: boolean
  /** 装備の個体 id（素の武器は null）。 */
  gear: string | null
  /** この個体のレア度・上振れ・3つのワザ。 */
  individual: WeaponIndividual
}>

/**
 * 武器の個体差。同じ武器でもレア度・攻撃力の上振れ・付くワザが変わる。
 * 鑑定ではレア度と上振れも抽選する。店・生産・加入時は N でワザ2枠を抽選する。
 * 数値は仮（002-foundation-rules）。
 */
export class WeaponRules {
  constructor(private readonly catalog: GameCatalog) {}

  #table() {
    return this.catalog.data.balance.weapon.rarity
  }

  /** 素の武器や表示用の基本構成。N・上振れなし。 */
  base(good: { readonly skills?: readonly string[] }): WeaponIndividual {
    return { rarity: "N", extraPower: 0, skills: [...(good.skills ?? [])] }
  }

  /** 装備の品物から個体を作る。乱数を渡すと武器の2枠を抽選する。 */
  forGood(
    good: WizDeepReadonly<GoodDef>,
    random?: Random
  ): WeaponIndividual | null {
    return good.kind === "weapon"
      ? {
          ...this.base(good),
          skills: random
            ? this.rollSkills(good, "N", random)
            : [...(good.skills ?? [])],
        }
      : null
  }

  /** 品物の id から個体を作る。 */
  forGoodId(id: string, random?: Random): WeaponIndividual | null {
    const good = this.catalog.good(id)
    return good ? this.forGood(good, random) : null
  }

  /**
   * レア度を重みつきで引く。深い層まで到達しているほど N 以外の重みが上がる
   * （`balance.depth.rarityPerLayer`）。rare（光るガラクタ）なら N は出ない。
   */
  rollRarity(random: Random, reached = 0, rare = false): Rarity {
    const weights = this.#table().weights
    const bonus = 1 + reached * this.catalog.data.balance.depth.rarityPerLayer
    return pickWeighted(random, rarities, (entry) => {
      const weight = weights[entry] ?? 0
      if (entry === "N") return rare ? 0 : weight
      return weight * bonus
    })
  }

  /** レア度ごとの攻撃力の上振れ。武器の攻撃力に対する割合で決める（端数は四捨五入）。 */
  rollExtraPower(
    good: { readonly power?: number },
    rarity: Rarity,
    random: Random
  ) {
    const [min, max] = this.#table().powerRate[rarity]
    return Math.round((good.power ?? 0) * (min + random() * (max - min)))
  }

  /** レア度で増える、その武器のワザの最大の使用回数。 */
  usesBonus(rarity: Rarity) {
    return this.#table().uses[rarity] ?? 0
  }

  /** 全レア度で、固有枠以外の2枠を重複なく抽選する。 */
  rollSkills(
    good: WizDeepReadonly<GoodDef>,
    _rarity: Rarity,
    random: Random
  ): string[] {
    const fixed = (good.skills ?? []).slice(0, FIXED_WEAPON_SKILLS)
    return [...fixed, ...drawWeighted(random, this.pool(good), 2, () => 1)]
  }

  pool(good: WizDeepReadonly<GoodDef>): string[] {
    return [
      ...new Set([
        ...(good.skills ?? []).slice(FIXED_WEAPON_SKILLS),
        ...(good.weaponType ? this.catalog.weaponPool(good.weaponType) : []),
      ]),
    ].filter(
      (id) => id !== good.skills?.[0] && !this.catalog.skill(id)?.blessing
    )
  }

  /** ガラクタの鑑定で生まれる個体。レア度・上振れ・ランダムなワザを一度に決める。 */
  roll(
    good: WizDeepReadonly<GoodDef>,
    random: Random,
    reached = 0,
    rare = false
  ): WeaponIndividual {
    const rarity = this.rollRarity(random, reached, rare)
    return {
      rarity,
      extraPower: this.rollExtraPower(good, rarity, random),
      skills: this.rollSkills(good, rarity, random),
    }
  }

  /** この個体のワザのうち、ランダムに入ったもの（武器の固定のワザと違う枠）。 */
  isRandomSkill(
    good: { readonly skills?: readonly string[] },
    index: number,
    skillId: string
  ) {
    if (index < FIXED_WEAPON_SKILLS || index >= WEAPON_SKILLS) return false
    return !!skillId && !!good.skills
  }

  /** レア度で上がる売値。 */
  sellPrice(price: number, rarity: Rarity | null) {
    if (!rarity) return price
    return Math.max(1, Math.round(price * (this.#table().sell[rarity] ?? 1)))
  }

  /** ユニークの固有の武器を鍛え直すとき、この武器を素材にして得られる手応え。 */
  materialProgress(rarity: Rarity | null) {
    const table = this.catalog.data.balance.unique.materialProgress
    return table[rarity ?? "N"] ?? 0
  }
}

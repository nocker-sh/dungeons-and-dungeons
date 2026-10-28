import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GoodDef } from "@/lib/wiz/content/content-schema"
import type { WeaponType } from "@/lib/wiz/content/constants"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { GameState, Gear, Member } from "@/lib/wiz/state/state-schema"
import type { StatBlock } from "@/lib/wiz/state/stat-block"
import { baseSellPrice } from "@/lib/wiz/rules/base-sell-price"
import { WeaponRules, type EquippedWeapon } from "@/lib/wiz/rules/weapon-rules"
import type { EquippedArmor } from "./types"

/** 装備・契約モード・装備制限。数値はCatalogから取得する。 */
export class PartyEquipment {
  private readonly weapons: WeaponRules
  /** 装備の一覧ごとの、持ち主別の装備（並びは一覧の順）。状態は不変なので一覧の参照で使い回す。 */
  readonly #owned = new WeakMap<
    GameState["gear"],
    ReadonlyMap<string, GameState["gear"][number][]>
  >()

  constructor(
    private readonly catalog: GameCatalog,
    weapons = new WeaponRules(catalog)
  ) {
    this.weapons = weapons
  }

  /** その仲間が持っている装備（一覧の順）。能力・武器・防具の計算で何度も引くので、持ち主ごとにまとめておく。 */
  gearOf(
    state: Pick<GameState, "gear">,
    owner: string
  ): readonly GameState["gear"][number][] {
    let byOwner = this.#owned.get(state.gear)
    if (!byOwner) {
      const groups = new Map<string, GameState["gear"][number][]>()
      for (const gear of state.gear) {
        if (!gear.owner) continue
        const list = groups.get(gear.owner)
        if (list) list.push(gear)
        else groups.set(gear.owner, [gear])
      }
      byOwner = groups
      this.#owned.set(state.gear, byOwner)
    }
    return byOwner.get(owner) ?? []
  }

  /** 悪魔と契約して戦う仲間（R）か。武器も防具も持たず、モードで戦い方が変わる。 */
  isPact(member: Pick<Member, "id">) {
    return !!this.catalog.member(member.id)?.pact
  }

  /** 契約のモード。レベルに届いたものだけ選べる。 */
  modesOf(member: Pick<Member, "id" | "lv">) {
    return (this.catalog.member(member.id)?.pact?.modes ?? []).map(
      (mode, index) => ({
        index,
        level: mode.level,
        weapon: mode.weapon,
        roles: mode.roles ?? [this.catalog.member(member.id)!.role],
        combatStyle: mode.combatStyle,
        open: member.lv >= mode.level,
      })
    )
  }

  /** モードで変わる役割。複合役割も保持する。 */
  rolesOf(member: Pick<Member, "id" | "lv" | "mode">) {
    return (
      this.modesOf(member)[this.modeOf(member)]?.roles ?? [
        this.catalog.member(member.id)!.role,
      ]
    )
  }

  /** いまのモードの番号。選べないモードを指していれば最初のモード。 */
  modeOf(member: Pick<Member, "id" | "lv" | "mode">) {
    const index = member.mode ?? 0
    return this.modesOf(member)[index]?.open ? index : 0
  }

  /** モードの強化の段。レベルで上がる（`balance.pact`）。 */
  pactPlus(lv: number) {
    const { plusPerLevel, maxPlus } = this.catalog.data.balance.pact
    return Math.min(maxPlus, Math.floor((lv - 1) * plusPerLevel))
  }

  /** 戦う武器。装備していなければ、得意な武器種に合わせた素の武器。契約の仲間はいまのモード。 */
  weaponOf(
    member: Pick<Member, "id"> & Partial<Pick<Member, "lv" | "mode">>,
    state: Pick<GameState, "gear">
  ): EquippedWeapon | null {
    if (this.isPact(member)) {
      const lv = member.lv ?? 1
      const mode = this.modesOf({ id: member.id, lv })[
        this.modeOf({ id: member.id, lv, mode: member.mode })
      ]
      const good = mode ? this.catalog.good(mode.weapon) : undefined
      if (!good) return null
      return {
        good,
        plus: this.pactPlus(lv),
        equipped: true,
        gear: null,
        individual: this.weapons.base(good),
      }
    }
    for (const gear of this.gearOf(state, member.id)) {
      const good = this.catalog.good(gear.good)
      if (good?.kind !== "weapon") continue
      return {
        good,
        plus: gear.plus,
        equipped: true,
        gear: gear.id,
        // 個体を持たない保存は境界で拒否するが、念のため固定値へ落とす
        individual: gear.weapon ?? this.weapons.base(good),
      }
    }
    const def = this.catalog.member(member.id)
    const good = def ? this.catalog.good(def.defaultWeapon) : undefined
    if (!good) return null
    return {
      good,
      plus: 0,
      equipped: false,
      gear: null,
      individual: this.weapons.base(good),
    }
  }

  /** 防具の最大の耐久。鍛冶屋の強化1段ごとに増える。 */
  maxDurabilityOf(good: { readonly durability?: number }, plus: number) {
    if (!good.durability) return 0
    return (
      good.durability + plus * this.catalog.data.balance.armor.durabilityPerPlus
    )
  }

  /** 装備している防具（着けていなければ null）。防具は一人一つ。 */
  armorOf(
    member: Pick<Member, "id">,
    state: Pick<GameState, "gear">
  ): EquippedArmor | null {
    if (this.isHero(member)) return null
    for (const gear of this.gearOf(state, member.id)) {
      const good = this.catalog.good(gear.good)
      if (good?.kind !== "armor") continue
      const maxDurability = this.maxDurabilityOf(good, gear.plus)
      return {
        gear: gear.id,
        good,
        plus: gear.plus,
        wear: gear.wear,
        maxDurability,
        durability: Math.max(0, maxDurability - gear.wear),
      }
    }
    return null
  }

  /** 耐久を1点直すのにかかるお金（合計は切り上げ）。 */
  repairCost(missing: number) {
    if (missing <= 0) return 0
    return Math.ceil(missing * this.catalog.data.balance.armor.repairPerPoint)
  }

  /** 得意な武器種。 */
  favoriteOf(member: Pick<Member, "id">): WeaponType | null {
    return this.catalog.member(member.id)?.favorite ?? null
  }

  /**
   * 必要な筋力・技量に届いていない分だけ下がる倍率。上回っても増えない。
   * 足りない能力ごとに（今の値 ÷ 必要な値）を掛け、balance.weapon.needFloor を下限にする。
   */
  requirementFactor(
    stats: Pick<StatBlock, "str" | "tec">,
    need: { readonly str: number; readonly tec: number }
  ) {
    const floor = this.catalog.data.balance.weapon.needFloor
    const ratio = (have: number, want: number) =>
      want <= 0 ? 1 : Math.max(floor, Math.min(1, have / want))
    return ratio(stats.str, need.str) * ratio(stats.tec, need.tec)
  }

  /** 得意な武器種なら高い倍率。契約の仲間のモードは、どの武器種でも本人の戦い方なので得意の倍率。 */
  favoriteFactor(member: Pick<Member, "id">, type: WeaponType | undefined) {
    const { favorite, other } = this.catalog.data.balance.weapon
    if (this.isPact(member)) return favorite
    return type && this.favoriteOf(member) === type ? favorite : other
  }

  /** 武器そのものの攻撃力。表示と戦闘で同じ強化量を使う。 */
  weaponPower(good: WizDeepReadonly<GoodDef>, plus: number, extraPower = 0) {
    return Math.round(
      (good.power ?? 0) + plus * (good.powerPerPlus ?? 1) + extraPower
    )
  }

  /** 装備の補正。強化1回ごとに、上がる能力（正の補正）がそれぞれ1増える。 */
  gearBonus(
    bonus: Partial<Record<keyof StatBlock, number>> | undefined,
    plus: number
  ): StatBlock {
    const value = (key: keyof StatBlock) => {
      const base = bonus?.[key] ?? 0
      return base > 0 ? base + plus : base
    }
    return {
      maxHp: value("maxHp"),
      str: value("str"),
      tec: value("tec"),
      spd: value("spd"),
    }
  }

  isHero(member: Pick<Member, "id">) {
    return !!this.catalog.member(member.id)?.hero
  }

  /**
   * 武器・防具の個体の売値。
   * レア度で上がり、強化・鍛え直しの段1つごとに `balance.sell.perPlus` の割合を足す。
   * 防具は減った耐久のぶんだけ修理代を引く（減った防具を売っても、直してから売るより損しない）。
   */
  sellPriceOf(gear: Pick<Gear, "good" | "plus" | "wear" | "weapon">) {
    const good = this.catalog.good(gear.good)
    if (!good) return 1
    const base = this.weapons.sellPrice(
      baseSellPrice(good),
      gear.weapon?.rarity ?? null
    )
    const { perPlus } = this.catalog.data.balance.sell
    const upgraded = Math.round(base * (1 + gear.plus * perPlus))
    const worn = good.kind === "armor" ? this.repairCost(gear.wear) : 0
    return Math.max(1, upgraded - worn)
  }

  /** 専用の武器を持つ仲間（R・ユニーク）。武器は付け替えられない。 */
  isUnique(member: Pick<Member, "id">) {
    return !!this.catalog.member(member.id)?.unique
  }

  /** 防具も変えられない仲間（固定装備）。 */
  isArmorFixed(member: Pick<Member, "id">) {
    const def = this.catalog.member(member.id)
    return !!def?.unique && !!def.fixedArmor
  }

  /** その仲間の、その種類（武器・防具）の装備を変えられないか。 */
  isSlotFixed(member: Pick<Member, "id">, kind: string | undefined) {
    return this.catalog.isSlotFixed(member.id, kind)
  }

  /** その装備の持ち主がユニークの仲間で、これがその固有の武器か。 */
  isFixedWeapon(gear: Pick<Gear, "good" | "owner">) {
    if (!gear.owner || !this.isUnique({ id: gear.owner })) return false
    return this.catalog.good(gear.good)?.kind === "weapon"
  }

  /** 持ち主から外せない装備か（専用の武器、または固定装備の仲間の防具）。 */
  isFixedGear(gear: Pick<Gear, "good" | "owner">) {
    if (!gear.owner) return false
    return this.isSlotFixed(
      { id: gear.owner },
      this.catalog.good(gear.good)?.kind
    )
  }

  /**
   * この装備を上げられる段の上限。
   * ふつうの装備は鍛冶屋の強化の段数、ユニークの固有の武器は `balance.unique.maxPlus`。
   */
  maxPlusOf(gear: Pick<Gear, "good" | "owner">) {
    if (this.isFixedWeapon(gear))
      return this.catalog.data.balance.unique.maxPlus
    return this.catalog.data.smithy?.upgrades.length ?? 0
  }
}

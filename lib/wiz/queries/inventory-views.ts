import { SupplyRules } from "@/lib/wiz/rules/supply-rules"
import { slotOf } from "@/lib/wiz/content/slot-of"
import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { Target } from "@/lib/wiz/content/constants"
import { Bag } from "@/lib/wiz/rules/bag"
import { baseSellPrice } from "@/lib/wiz/rules/base-sell-price"
import { effectSpec } from "@/lib/wiz/rules/item-effect-spec"
import { usableInField } from "@/lib/wiz/rules/field-usable"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type {
  Expedition,
  GameState,
  WeaponIndividual,
} from "@/lib/wiz/state/state-schema"
import { memberName } from "@/lib/wiz/queries/member-name"
import { SLOT_NAMES, WEAPON_TYPE_NAMES } from "@/lib/wiz/queries/names"
import { STATUS_NAMES } from "@/lib/wiz/queries/status-resistance-view"
import type { GoodViews } from "@/lib/wiz/queries/good-views"

/** 袋と装備の見え方。売値・耐久・持ち主を添える。 */
export class InventoryViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly rules: PartyRules,
    private readonly goods: GoodViews
  ) {}

  /** 武器と防具の個体。持ち主の名前つき。 */
  gear(state: GameState, ids?: ReadonlySet<string>) {
    return state.gear.flatMap((gear) => {
      if (ids && !ids.has(gear.id)) return []
      const good = this.catalog.good(gear.good)
      if (!good) return []
      const owner = gear.owner
        ? memberName(this.catalog, state, gear.owner)
        : null
      const label = this.goods.gearLabel(
        good,
        gear.plus,
        gear.wear,
        gear.weapon
      )
      return [
        this.goods.entry(good, {
          name: gear.unidentified
            ? `だれかの${good.weaponType ? WEAPON_TYPE_NAMES[good.weaponType] : "武器"}`
            : label.name,
          stat: gear.unidentified ? "未鑑定" : label.stat,
          desc: gear.unidentified
            ? "冒険者が武器屋で買い、鍛えながら使っていた武器。持ち主が命を落としたり、置き去りにしたりしてダンジョンに残った。武器屋で鑑定すると正体と強化が分かる。"
            : good.desc,
          weapon: gear.unidentified ? null : label.weapon,
          allowedJobs: gear.unidentified ? null : (good.allowedJobs ?? null),
          unidentified: !!gear.unidentified,
          plus: gear.unidentified ? 0 : gear.plus,
          key: gear.id,
          gear: gear.id,
          slot: slotOf(good),
          slotName: SLOT_NAMES[slotOf(good)] ?? slotOf(good),
          owner,
          ownerId: gear.owner,
          /** ユニークの仲間の固有の武器（外せない・強化でなく鍛え直し）。 */
          fixed: this.rules.equipment.isFixedWeapon(gear),
          /** 持ち主から外せない（専用の武器、または固定装備の仲間の防具）。 */
          locked: this.rules.equipment.isFixedGear(gear),
          /** 武器なら個体のレア度（防具は null）。 */
          rarity: gear.unidentified ? null : (gear.weapon?.rarity ?? null),
          /** 売値（レア度・強化の段・減った耐久を含む）。 */
          price: gear.unidentified ? 0 : this.rules.equipment.sellPriceOf(gear),
          /** 防具なら耐久（武器は null）。 */
          armor:
            good.kind === "armor"
              ? {
                  durability: Math.max(
                    0,
                    this.rules.equipment.maxDurabilityOf(good, gear.plus) -
                      gear.wear
                  ),
                  maxDurability: this.rules.equipment.maxDurabilityOf(
                    good,
                    gear.plus
                  ),
                  wear: gear.wear,
                  gold: this.rules.equipment.repairCost(gear.wear),
                }
              : null,
        }),
      ]
    })
  }

  /** 袋の道具。field は戦闘の外で使えるか。 */
  items(state: GameState) {
    // 保存では同じ品が別の束でもよいが、表示と操作のキーは一品に一つ。
    return Bag.add([], SupplyRules.available(state, this.catalog)).flatMap(
      (entry) => {
        const good = this.catalog.good(entry.good)
        const targets =
          good?.kind === "item" && good.effect
            ? this.rules.itemTargets(state, good.effect)
            : []
        const refillUses =
          good?.effect?.type === "refill" ? good.effect.uses : null
        const revive = good?.effect?.type === "revive"
        const healHp =
          good?.effect?.type === "heal" || revive ? good.effect.hp : null
        const cureKinds =
          good?.effect?.type === "cure" ? good.effect.kinds : null
        return good?.kind === "item"
          ? [
              this.goods.entry(good, {
                key: good.id,
                count: entry.count,
                field: usableInField(good.effect),
                /** 誰に使うか。ally なら一人を選ぶ。 */
                target: good.effect
                  ? (effectSpec(good.effect).target as Target)
                  : null,
                revive: !!good.effect && !!effectSpec(good.effect).revive,
                curing: cureKinds
                  ? state.party.flatMap((id) => {
                      const member = state.members.find(
                        (member) => member.id === id
                      )
                      if (!member || member.hp <= 0) return []
                      const kinds = member.status
                        .filter((entry) => cureKinds.includes(entry.kind))
                        .map((entry) => entry.kind)
                      if (!kinds.length) return []
                      return [
                        {
                          id,
                          name: memberName(this.catalog, state, id),
                          kinds,
                          names: kinds.map((kind) => STATUS_NAMES[kind]),
                        },
                      ]
                    })
                  : null,
                healing:
                  healHp !== null
                    ? state.party.flatMap((id) => {
                        const member = state.members.find(
                          (member) => member.id === id
                        )
                        if (
                          !member ||
                          (revive ? member.hp > 0 : member.hp <= 0)
                        )
                          return []
                        const maxHp = this.rules.stats(member, state).maxHp
                        const after = Math.min(maxHp, member.hp + healHp)
                        return [
                          {
                            id,
                            name: memberName(this.catalog, state, id),
                            hp: member.hp,
                            after,
                            maxHp,
                            restored: after - member.hp,
                          },
                        ]
                      })
                    : null,
                refill:
                  refillUses !== null
                    ? {
                        perSkill: refillUses,
                        members: state.party.flatMap((id) => {
                          const member = state.members.find(
                            (member) => member.id === id
                          )
                          if (!member || member.hp <= 0) return []
                          return [
                            {
                              id,
                              name: memberName(this.catalog, state, id),
                              restored: this.rules.skills.refillUses(
                                member,
                                refillUses
                              ).restored,
                            },
                          ]
                        }),
                      }
                    : null,
                /** 効く相手（味方に使う道具だけ）。ここにいない仲間には使えない。 */
                targets,
                /** 効く相手がいて使えるか。 */
                usable: good.effect
                  ? !this.#toAlly(good.effect) || targets.length > 0
                  : false,
              }),
            ]
          : []
      }
    )
  }

  /** 今回の探索で拾い、まだ持っている戦利品。出撃前の所持品を含めない。 */
  carried(state: GameState, loot?: Expedition["loot"]) {
    if (!loot) return null
    const dropped = new Set(loot.weapons ?? [])
    return {
      gold: loot.gold,
      goods: Bag.add([], loot.goods).flatMap((entry) => {
        const good = this.catalog.good(entry.good)
        const count = Math.min(entry.count, Bag.count(state.bag, entry.good))
        return good && count > 0 ? [this.goods.entry(good, { count })] : []
      }),
      gear: this.gear(state, dropped),
    }
  }

  supplies(state: GameState) {
    const packed = SupplyRules.packed(state, this.catalog)
    const count = packed.reduce((total, entry) => total + entry.count, 0)
    return {
      count,
      capacity: SupplyRules.capacity,
      editable: state.phase.type === "town" && !state.conversation?.active,
      items: Bag.add([], state.bag).flatMap((entry) => {
        const good = this.catalog.good(entry.good)
        if (good?.kind !== "item") return []
        const carried = Bag.count(packed, entry.good)
        return [
          {
            id: good.id,
            name: good.name,
            desc: good.desc,
            stat:
              good.effect?.type === "refill"
                ? `各ワザの残り +${good.effect.uses}`
                : good.stat,
            total: entry.count,
            carried,
            stored: entry.count - carried,
            canAdd: count < SupplyRules.capacity && carried < entry.count,
          },
        ]
      }),
    }
  }

  /** 味方ひとり（または味方全員）に使う道具か。 */
  #toAlly(effect: Parameters<typeof effectSpec>[0]) {
    const target = effectSpec(effect).target
    return target === "ally" || target === "allies"
  }

  /** 袋の素材。 */
  materials(state: GameState) {
    return Bag.add([], state.bag).flatMap((entry) => {
      const good = this.catalog.good(entry.good)
      return good?.kind === "material"
        ? [this.goods.entry(good, { key: good.id, count: entry.count })]
        : []
    })
  }

  /**
   * 仲間が着けられる装備：その仲間以外が持つ、または誰も着けていない個体。
   * 専用の武器を持つ仲間（R）は防具だけ、固定装備の仲間は何も返さない。
   * 専用の武器・固定装備はほかの仲間へ移せないので候補にしない。
   * gearId を指定した比較では、その個体だけ表示を作る。
   */
  equipOptions(state: GameState, memberId: string, gearId?: string) {
    const member = state.members.find((member) => member.id === memberId)
    if (!member) return []
    // 候補になりうる個体だけ表示を作る（拾った武器が増えても重くならない）
    const candidates = new Set(
      state.gear
        .filter(
          (gear) =>
            (gearId === undefined || gear.id === gearId) &&
            !gear.unidentified &&
            gear.owner !== memberId &&
            this.catalog.canEquip(memberId, gear.good)
        )
        .map((gear) => gear.id)
    )
    return this.gear(state, candidates).filter(
      (entry) =>
        !entry.unidentified &&
        entry.ownerId !== memberId &&
        this.catalog.canEquip(memberId, entry.id) &&
        !this.rules.equipment.isSlotFixed(member, entry.kind) &&
        !entry.locked
    )
  }

  /** 装備をすべて変えられないときの理由。悪魔と契約して戦う仲間（R）と、固定装備の仲間。 */
  gearLock(memberId: string) {
    if (this.rules.equipment.isPact({ id: memberId })) {
      const name = this.catalog.member(memberId)?.name ?? memberId
      return `${name}は悪魔と契約して戦う。武器も防具も持たない（戦闘中の「ケイヤク」で戦い方を変える）`
    }
    if (!this.rules.equipment.isArmorFixed({ id: memberId })) return null
    const name = this.catalog.member(memberId)?.name ?? memberId
    return `${name}はユニークの仲間。装備は変えられない（固有の武器は鍛冶屋で鍛え直す）`
  }

  /** 武器を付け替えられないときの理由。専用の武器を持つ仲間（R）は防具だけ着替えられる。 */
  weaponLock(memberId: string) {
    if (!this.rules.equipment.isUnique({ id: memberId })) return null
    if (this.rules.equipment.isArmorFixed({ id: memberId })) return null
    const name = this.catalog.member(memberId)?.name ?? memberId
    return `${name}の武器は専用の武器。付け替えられない（鍛冶屋で鍛え直す）`
  }

  /**
   * この武器を持つと攻撃力が上がる出撃メンバー（上がり幅の大きい順）。
   * 鑑定や買い物の直後に「誰の武器より強いか」を見せる。装備を変えられない仲間は除く。
   */
  upgrades(state: GameState, gearId: string) {
    const gear = state.gear.find((entry) => entry.id === gearId)
    if (!gear || gear.unidentified) return []
    return this.#gains(state, gear.good, gear.plus, gear.weapon, gear.owner)
  }

  /** 店の武器（N・強化なし）を買って持つと攻撃力が上がる出撃メンバー（上がり幅の大きい順）。 */
  upgradesForGood(state: GameState, goodId: string) {
    return this.#gains(state, goodId, 0, null, null)
  }

  /**
   * 誰も着けていない武器を、出撃メンバーへ一番強くなるように割り振る案。
   * 上がり幅の大きい組から順に決め、一人に一つ・一つの武器は一人にだけ。
   * 装備を変えられない仲間は除く。画面はこの案のとおりに装備のコマンドを送る。
   */
  bestWeapons(state: GameState) {
    const free = state.gear.filter(
      (gear) =>
        !gear.unidentified &&
        !gear.owner &&
        this.catalog.good(gear.good)?.kind === "weapon"
    )
    const pairs = free.flatMap((gear) =>
      this.#gains(state, gear.good, gear.plus, gear.weapon, null).map(
        (gain) => ({ ...gain, gear: gear.id })
      )
    )
    pairs.sort(
      (left, right) => right.after - right.before - (left.after - left.before)
    )
    const plan: (typeof pairs)[number][] = []
    for (const pair of pairs) {
      if (plan.some((entry) => entry.member === pair.member)) continue
      if (plan.some((entry) => entry.gear === pair.gear)) continue
      plan.push(pair)
    }
    return plan
  }

  /** その武器を持ったときに攻撃力が上がる出撃メンバー。owner は今の持ち主（比べない）。 */
  #gains(
    state: GameState,
    goodId: string,
    plus: number,
    individual: WeaponIndividual | null,
    owner: string | null
  ) {
    const good = this.catalog.good(goodId)
    if (good?.kind !== "weapon") return []
    return state.party
      .flatMap((id) => {
        const member = state.members.find((entry) => entry.id === id)
        if (
          !member ||
          this.rules.equipment.isUnique(member) ||
          this.rules.equipment.isPact(member)
        )
          return []
        if (owner === id || !this.catalog.canEquip(id, good.id)) return []
        const current = this.rules.equipment.weaponOf(member, state)
        const before = current
          ? this.rules.attackWith(member, state, current)
          : 1
        const after = this.rules.attackWith(member, state, {
          good,
          plus,
          equipped: true,
          gear: null,
          individual: individual ?? this.goods.baseWeapon(good),
        })
        if (after <= before) return []
        return [
          {
            member: id,
            name: memberName(this.catalog, state, id),
            before,
            after,
          },
        ]
      })
      .sort(
        (left, right) => right.after - right.before - (left.after - left.before)
      )
  }

  /** 売れる物：袋の品物と、誰も装備していない武器・防具。 */
  sellables(state: GameState) {
    const bag = Bag.add([], state.bag).flatMap((entry) => {
      const good = this.catalog.good(entry.good)
      return good && good.sellable !== false
        ? [
            this.goods.entry(good, {
              key: `bag:${good.id}`,
              sell: { good: good.id } as { good?: string; gear?: string },
              count: entry.count,
              price: baseSellPrice(good),
            }),
          ]
        : []
    })
    const gear = this.gear(state)
      .filter(
        (entry) =>
          !entry.ownerId &&
          !entry.unidentified &&
          this.catalog.good(entry.id)?.sellable !== false
      )
      .map((entry) => ({
        ...entry,
        key: `gear:${entry.gear}`,
        sell: { gear: entry.gear } as { good?: string; gear?: string },
        count: 1,
      }))
    return [...gear, ...bag]
  }

  junk(state: GameState) {
    const good = this.catalog.good(this.catalog.data.junk)!
    return this.goods.entry(good, {
      key: good.id,
      count: Bag.count(state.bag, good.id),
    })
  }

  /** 光るガラクタ（作品に無ければ null）。 */
  rareJunk(state: GameState) {
    const id = this.catalog.data.rareJunk
    const good = id ? this.catalog.good(id) : undefined
    if (!good) return null
    return this.goods.entry(good, {
      key: good.id,
      count: Bag.count(state.bag, good.id),
    })
  }
}

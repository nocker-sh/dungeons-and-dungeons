import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { Bag } from "@/lib/wiz/rules/bag"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GoodViews } from "@/lib/wiz/queries/good-views"
import type { InventoryViews } from "@/lib/wiz/queries/inventory-views"
import type { MemberViews } from "@/lib/wiz/queries/member-views"
import { memberName } from "@/lib/wiz/queries/member-name"

/** 鍛冶屋の見え方：強化・生産・鍛え直し・修理。 */
export class SmithyViews {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly weapons: WeaponRules,
    private readonly goods: GoodViews,
    private readonly inventory: InventoryViews,
    private readonly members: MemberViews,
    private readonly rules: PartyRules
  ) {}

  /** 店頭の案内。メニューを開くまでは装備ごとの詳細を作らない。 */
  overview(state: GameState) {
    const smithy = this.catalog.data.smithy
    if (!smithy) return null
    return {
      books: smithy.skillBook ? Bag.count(state.bag, smithy.skillBook) : 0,
      hasReforge: state.gear.some((gear) =>
        this.rules.equipment.isFixedWeapon(gear)
      ),
    }
  }

  /**
   * 鍛冶屋：ユニークの固有の武器を鍛え直す。
   * 素材は誰も着けていない武器の個体。レア度が高いほど手応えが大きい。
   */
  reforges(state: GameState) {
    const rules = this.catalog.data.balance.unique
    const inventory = this.inventory.gear(state)
    const materials = inventory.filter(
      (entry) =>
        !entry.unidentified && !entry.ownerId && entry.kind === "weapon"
    )
    return inventory
      .filter((entry) => entry.fixed)
      .map((entry) => {
        const gear = state.gear.find((item) => item.id === entry.gear)!
        const good = this.catalog.good(gear.good)!
        const max = gear.plus >= rules.maxPlus
        return {
          key: entry.gear,
          gear: entry.gear,
          member: gear.owner,
          memberName: entry.owner ?? "",
          name: entry.name,
          good: good.id,
          plus: gear.plus,
          maxPlus: rules.maxPlus,
          max,
          /** 次の段までの手応え。 */
          progress: gear.progress,
          need: rules.progressPerStep,
          gold: rules.gold,
          stat: entry.stat,
          next: max
            ? null
            : this.goods.gearLabel(good, gear.plus + 1, 0, gear.weapon),
          /** 素材にできる武器の個体（得られる手応えつき）。 */
          materials: materials.map((item) => ({
            ...item,
            /** この武器を素材にして得られる手応え。 */
            progress: this.weapons.materialProgress(item.rarity),
          })),
          ready: !max && state.gold >= rules.gold && materials.length > 0,
        }
      })
  }

  /** 自動プレイなど、鍛冶屋の全メニューをまとめて調べる側の受け口。 */
  smithy(state: GameState) {
    if (!this.catalog.data.smithy) return null
    return {
      upgrades: this.upgrades(state)!,
      recipes: this.recipes(state)!,
      ...this.inscriptions(state)!,
    }
  }

  /** 強化できる装備。ユニークの固有の武器は「鍛え直し」で扱う。 */
  upgrades(state: GameState) {
    const smithy = this.catalog.data.smithy
    if (!smithy) return null
    const gearById = new Map(state.gear.map((gear) => [gear.id, gear]))
    return this.inventory
      .gear(state)
      .filter((entry) => !entry.unidentified && !entry.fixed)
      .map((entry) => {
        const cost = smithy.upgrades[entry.plus]
        const materials = cost
          ? this.goods.materialNeeds(state, cost.materials)
          : []
        const good = this.catalog.good(entry.id)!
        const gear = gearById.get(entry.gear)!
        return {
          ...entry,
          next: cost
            ? this.goods.gearLabel(good, gear.plus + 1, gear.wear, gear.weapon)
            : null,
          gold: cost?.gold ?? null,
          materials,
          max: !cost,
          missingGold: !!cost && state.gold < cost.gold,
          missingMaterials: materials.some((item) => item.have < item.count),
          ready:
            !!cost &&
            state.gold >= cost.gold &&
            materials.every((item) => item.have >= item.count),
        }
      })
  }

  /** 生産のレシピと費用。所持装備の詳細は必要ない。 */
  recipes(state: GameState) {
    const smithy = this.catalog.data.smithy
    if (!smithy) return null
    return smithy.recipes.flatMap((recipe) => {
      const good = this.catalog.good(recipe.good)
      if (!good) return []
      const materials = this.goods.materialNeeds(state, recipe.materials)
      return [
        this.goods.entry(good, {
          key: recipe.id,
          recipe: recipe.id,
          gold: recipe.gold,
          materials,
          ready:
            state.gold >= recipe.gold &&
            materials.every((item) => item.have >= item.count),
          missingGold: state.gold < recipe.gold,
          missingMaterials: materials.some((item) => item.have < item.count),
        }),
      ]
    })
  }

  /** ワザ変更の候補と、スキルの書の在庫。 */
  inscriptions(state: GameState) {
    const smithy = this.catalog.data.smithy
    if (!smithy) return null
    const book = smithy.skillBook
    const books = book ? Bag.count(state.bag, book) : 0
    const inscriptions = state.gear.flatMap((gear) => {
      const good = this.catalog.good(gear.good)
      if (gear.unidentified || !gear.weapon || !good) return []
      const weapon = this.goods.weaponEntry(good, gear.plus, gear.weapon)
      if (!weapon) return []
      return [
        {
          gear: gear.id,
          name: gear.plus ? `${good.name}+${gear.plus}` : good.name,
          rarity: weapon.rarity,
          owner: gear.owner
            ? this.members.member(state, gear.owner)?.name
            : null,
          skills: weapon.skills,
          candidates: this.goods.skillList(
            this.weapons
              .pool(good)
              .filter((id) => !gear.weapon!.skills.includes(id)),
            undefined,
            weapon.usesBonus
          ),
        },
      ]
    })
    return { books, inscriptions }
  }

  /** 鍛冶屋の修理：仲間ごとの防具の耐久と費用、まとめて直す費用。 */
  repairs(state: GameState) {
    const order = [
      ...state.party,
      ...state.members
        .filter((member) => !state.party.includes(member.id))
        .map((member) => member.id),
    ]
    const rows = order.flatMap((id) => {
      const member = state.members.find((entry) => entry.id === id)
      const armor = member ? this.members.armor(state, member) : null
      if (!member || !armor) return []
      return [
        {
          key: armor.gear,
          member: member.id,
          memberName: memberName(this.catalog, state, member.id),
          gear: armor.gear,
          good: armor.good,
          name: armor.name,
          durability: armor.durability,
          maxDurability: armor.maxDurability,
          wear: armor.wear,
          gold: armor.gold,
          full: armor.wear === 0,
          ready: armor.wear > 0 && state.gold >= armor.gold,
          inParty: state.party.includes(member.id),
        },
      ]
    })
    const wear = rows.reduce((sum, row) => sum + row.wear, 0)
    const gold = rows.reduce((sum, row) => sum + row.gold, 0)
    return {
      rows,
      /** 全部直すとき。 */
      all: { wear, gold, ready: wear > 0 && state.gold >= gold },
    }
  }
}

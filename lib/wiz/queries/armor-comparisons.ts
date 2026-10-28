import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { GameState, Member } from "@/lib/wiz/state/state-schema"
import type { InventoryViews } from "@/lib/wiz/queries/inventory-views"
import { memberName } from "@/lib/wiz/queries/member-name"

/** 防具の着替え・取り外し・未所持の目標を、実際の装備補正で比較する。 */
export class ArmorComparisons {
  constructor(
    private readonly catalog: GameCatalog,
    private readonly rules: PartyRules,
    private readonly inventory: InventoryViews
  ) {}

  /** 未所持の防具を未強化・消耗なしで比較する。元の状態は変更しない。 */
  armorGoalComparison(state: GameState, memberId: string, goodId: string) {
    if (this.catalog.good(goodId)?.kind !== "armor") return null
    let gearId = `armor-goal:${goodId}`
    while (state.gear.some((gear) => gear.id === gearId)) gearId += ":preview"
    return this.armorComparison(
      {
        ...state,
        gear: [
          ...state.gear,
          {
            id: gearId,
            good: goodId,
            owner: null,
            plus: 0,
            wear: 0,
            progress: 0,
            weapon: null,
          },
        ],
      },
      memberId,
      gearId
    )
  }

  /** 表示する防具だけ、実際の装備補正で着替え前後を計算する。 */
  armorComparison(state: GameState, memberId: string, gearId: string) {
    const entry = this.inventory
      .equipOptions(state, memberId, gearId)
      .find((entry) => entry.gear === gearId)
    if (!entry?.armor) return null
    const member = state.members.find((member) => member.id === memberId)!
    const afterState = {
      ...state,
      gear: state.gear.map((gear) => {
        if (gear.id === entry.gear) return { ...gear, owner: memberId }
        if (
          gear.owner === memberId &&
          this.catalog.good(gear.good)?.kind === "armor"
        )
          return { ...gear, owner: null }
        return gear
      }),
    }
    const armor = this.rules.equipment.armorOf(member, state)
    const previousOwner = entry.ownerId
      ? state.members.find((candidate) => candidate.id === entry.ownerId)
      : undefined
    const ownerArmor = previousOwner
      ? this.rules.equipment.armorOf(previousOwner, state)
      : null
    return {
      previousOwner: previousOwner
        ? {
            id: previousOwner.id,
            name: memberName(this.catalog, state, previousOwner.id),
            before: {
              ...this.#memberStats(state, previousOwner),
              durability: ownerArmor?.durability ?? 0,
              maxDurability: ownerArmor?.maxDurability ?? 0,
            },
            after: {
              ...this.#memberStats(afterState, previousOwner, true),
              durability: 0,
              maxDurability: 0,
            },
          }
        : null,
      before: {
        ...this.#memberStats(state, member),
        durability: armor?.durability ?? 0,
        maxDurability: armor?.maxDurability ?? 0,
      },
      after: {
        ...this.#memberStats(afterState, member, true),
        durability: entry.armor.durability,
        maxDurability: entry.armor.maxDurability,
      },
    }
  }

  /** 防具を外した後の耐久と能力。外せない個体は候補にしない。 */
  armorRemovalComparison(state: GameState, gearId: string) {
    const gear = state.gear.find((entry) => entry.id === gearId)
    if (!gear?.owner || this.catalog.good(gear.good)?.kind !== "armor")
      return null
    const member = state.members.find((entry) => entry.id === gear.owner)
    if (!member || this.rules.equipment.isFixedGear(gear)) return null
    const afterState = {
      ...state,
      gear: state.gear.map((entry) =>
        entry.id === gearId ? { ...entry, owner: null } : entry
      ),
    }
    const armor = this.rules.equipment.armorOf(member, state)
    return {
      before: {
        ...this.#memberStats(state, member),
        durability: armor?.durability ?? 0,
        maxDurability: armor?.maxDurability ?? 0,
      },
      after: {
        ...this.#memberStats(afterState, member, true),
        durability: 0,
        maxDurability: 0,
      },
    }
  }

  /** 変更前は現在のHPを保ち、変更後は装備後の最大HPに収める。 */
  #memberStats(state: GameState, member: Member, after = false) {
    const stats = this.rules.stats(member, state)
    return {
      ...stats,
      attack: this.rules.attack(member, state),
      hp: after ? Math.min(member.hp, stats.maxHp) : member.hp,
    }
  }
}

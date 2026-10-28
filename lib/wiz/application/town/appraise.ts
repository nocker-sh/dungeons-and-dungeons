import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
import { pickWeighted } from "@/lib/wiz/rules/pick-weighted"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/**
 * ガラクタを一つ鑑定する。店ごとに出てくる物が違う。
 * 武器は個体を引く：レア度（N・R・SR）で攻撃力が上振れし、固定でない2枠がランダムなワザに変わる。
 * 候補は到達した層の前後の段。一つ先の段は掘り出し物として出にくい。
 * 光るガラクタ（rare）は武器だけから引き、必ず R 以上になる。
 */
export class Appraise {
  static readonly featureId = "W010"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "weapons">
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"appraise">,
    environment: WizWorldEnvironment
  ): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const { catalog } = this.deps
    if (input.gear) {
      const gear = state.gear.find((entry) => entry.id === input.gear)
      if (!gear) return reject("NOT_OWNED")
      if (!gear.unidentified || gear.owner) return reject("UNAVAILABLE")
      const good = catalog.good(gear.good)
      const weaponShop = catalog
        .shop(input.shop)
        ?.appraise?.some((id) => catalog.good(id)?.kind === "weapon")
      if (!weaponShop || good?.kind !== "weapon") return reject("UNAVAILABLE")
      return accept(
        {
          ...state,
          gear: state.gear.map((entry) =>
            entry.id === gear.id ? { ...entry, unidentified: false } : entry
          ),
        },
        {
          type: "appraised",
          good: gear.good,
          gear: gear.id,
          rarity: gear.weapon?.rarity ?? null,
        }
      )
    }
    const rare = !!input.rare
    const junk = rare ? catalog.data.rareJunk : catalog.data.junk
    if (!junk) return reject("UNAVAILABLE")
    // 光るガラクタは武器だけから引く
    const candidates = catalog
      .appraisalPool(input.shop, state.reached)
      .filter((id) => !rare || catalog.good(id)?.kind === "weapon")
    if (!candidates.length) return reject("UNAVAILABLE")
    const bag = Bag.remove(state.bag, junk)
    if (!bag) return reject("NO_JUNK")
    // 一つ先の段の品は掘り出し物として出にくい（balance.appraisal.ahead）
    const good = this.deps.catalog.good(
      pickWeighted(environment.random, candidates, (id) =>
        this.deps.catalog.appraisalWeight(id, state.reached)
      )
    )
    if (!good) return reject("UNKNOWN")
    if (good.kind !== "weapon" && good.kind !== "armor")
      return accept(
        { ...state, bag: Bag.add(bag, [{ good: good.id, count: 1 }]) },
        { type: "appraised", good: good.id, gear: null, rarity: null }
      )
    const gear = environment.nextId()
    // 深い層まで到達しているほど R・SR が出やすい（balance.depth.rarityPerLayer）
    const weapon =
      good.kind === "weapon"
        ? this.deps.weapons.roll(good, environment.random, state.reached, rare)
        : null
    return accept(
      {
        ...state,
        bag,
        gear: [
          ...state.gear,
          {
            id: gear,
            good: good.id,
            owner: null,
            plus: 0,
            progress: 0,
            wear: 0,
            weapon,
          },
        ],
      },
      {
        type: "appraised",
        good: good.id,
        gear,
        rarity: weapon?.rarity ?? null,
      }
    )
  }
}

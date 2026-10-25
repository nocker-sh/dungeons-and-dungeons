import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules"
import type { Battle, Expedition, GameEvent, GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { partyMembers } from "@/lib/wiz/application/party-members"
import { updateMembers } from "@/lib/wiz/application/update-members"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"
import { firstLiving } from "@/lib/wiz/application/expedition/first-living"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"

/** 次の地点へ進み、着いた地点の出来事を解決する。戦闘なら戦闘へ移る。 */
export class Advance {
  static readonly featureId = "W002"
  constructor(
    private readonly deps: Pick<
      GameDependencies,
      "catalog" | "expedition" | "battle"
    >
  ) {}

  execute(
    state: GameState,
    input: GameActionOf<"advance">,
    environment: WizWorldEnvironment
  ): Transition {
    if (state.phase.type !== "expedition") return reject("WRONG_PHASE")
    const current = state.phase.expedition
    if (current.pending) return reject("PENDING")
    // 動ける仲間がいないまま地点へ進むと、次の戦闘で誰も手番を持てず手詰まりになる
    if (partyMembers(state).every((member) => member.hp <= 0))
      return reject("DOWN")
    const layer = this.deps.catalog.layer(current.layer)
    const here = this.deps.catalog.station(current.layer, current.at)
    if (!layer || !here) return reject("UNKNOWN")
    if (here.boss) return reject("AT_END")
    if (!here.next.includes(input.to)) return reject("NOT_NEXT")
    const there = this.deps.catalog.station(current.layer, input.to)
    if (!there) return reject("UNKNOWN")

    const random = environment.random
    const kind =
      current.surveyed?.find((entry) => entry.station === there.id)?.kind ??
      this.deps.expedition.draw(layer, there, random)
    const exploration = new ExplorationRules(this.deps.catalog)
    const wear = this.deps.expedition.wear()
    let expedition: Expedition = {
      ...current,
      at: there.id,
      visited: [...current.visited, there.id],
      events: [...current.events, { station: there.id, kind }],
      pending: null,
    }
    let next: GameState = {
      ...state,
      members: updateMembers(state, (member) => ({
        ...member,
        fatigue: Math.min(100, member.fatigue + wear.fatigue),
        dirt: Math.min(100, member.dirt + wear.dirt),
      })),
    }
    const events: GameEvent[] = [{ type: "arrived", station: there.id, kind }]
    const mimic =
      kind === "treasure"
        ? this.deps.expedition.mimic(layer, there, random)
        : null

    if (kind === "discovery") {
      if (!there.discovery) return reject("UNKNOWN")
      expedition = { ...expedition, pending: { kind: "discovery" } }
    }
    if (kind === "treasure" && !mimic) {
      const found = this.deps.expedition.treasure(layer, there, random)
      found.gold = exploration.gold(state, found.gold)
      expedition = {
        ...expedition,
        pending: { kind: "treasure", gold: found.gold, goods: found.goods },
        loot: {
          gold: expedition.loot.gold + found.gold,
          goods: Bag.add(expedition.loot.goods, found.goods),
        },
      }
      next = {
        ...next,
        gold: next.gold + found.gold,
        bag: Bag.add(next.bag, found.goods),
      }
      events.push({ type: "treasure", gold: found.gold, goods: found.goods })
    }
    if (kind === "trap") {
      const damage = exploration.trap(
        state,
        this.deps.expedition.trap(layer, random)
      )
      expedition = { ...expedition, pending: { kind: "trap", damage } }
      // 仮ルール：罠では倒れない
      next = {
        ...next,
        members: updateMembers(next, (member) => ({
          ...member,
          hp: member.hp > 0 ? Math.max(1, member.hp - damage) : 0,
        })),
      }
      events.push({ type: "trap", damage })
    }
    if (kind === "battle" || kind === "midboss" || kind === "boss" || mimic) {
      const boss = kind === "boss"
      // ボスは層のボス、中ボスなど決まった敵の地点はその敵、ほかは層の敵から選ぶ
      const foeIds = mimic
        ? [mimic]
        : boss
          ? [layer.boss]
          : there.foes
            ? [...there.foes]
            : this.deps.expedition.foes(layer, random)
      const foes: Battle["foes"] = foeIds.map((foeId, index) => {
        const hp = this.deps.catalog.foe(foeId)?.hp ?? 1
        return {
          id: `foe-${index + 1}`,
          foe: foeId,
          appearanceId: environment.nextId(),
          hp,
          maxHp: hp,
          status: [],
        }
      })
      const battle: Battle = {
        foes,
        order: this.deps.battle.order(next, foes),
        turn: 0,
        guarding: [],
        boss,
      }
      events.push({ type: "encounter", foes: foeIds, boss })
      return accept(
        {
          ...next,
          phase: {
            type: "battle",
            expedition,
            battle: { ...battle, turn: firstLiving(next, battle, 0) },
          },
        },
        ...events
      )
    }
    return accept(
      { ...next, phase: { type: "expedition", expedition } },
      ...events
    )
  }
}

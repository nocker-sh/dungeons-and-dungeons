import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import { Bag, between, pickWeighted, type Random } from "@/lib/wiz/rules"
import type { Battle, GameEvent, GameState, Gear, Stack } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { accept, type Transition } from "@/lib/wiz/application/transition"
import type { BattlePhase } from "@/lib/wiz/application/battle/battle-phase"

/** 敵を全員倒したときの精算。経験値・金貨・落とし物・召喚石・依頼の進み・層の解放。 */
export class Victory {
  constructor(
    private readonly deps: Pick<
      GameDependencies,
      "catalog" | "expedition" | "weapons"
    >
  ) {}

  resolve(
    state: GameState,
    phase: BattlePhase,
    battle: Battle,
    random: Random,
    events: GameEvent[],
    nextId: () => string
  ): Transition {
    let gold = 0
    let goods: Stack[] = []
    let exp = 0
    let stones = 0
    for (const entry of battle.foes) {
      const foe = this.deps.catalog.foe(entry.foe)
      if (!foe) continue
      exp += foe.exp
      gold += between(random, foe.gold[0], foe.gold[1])
      stones += foe.stones ?? 0
      goods = Bag.add(
        goods,
        foe.drops.map((drop) => ({ good: drop.good, count: drop.count }))
      )
    }
    // 深い地点ほど稼ぎが増える（進むほど得になるようにする・balance.depth.gold）
    const layer = phase.townQuest
      ? null
      : this.deps.catalog.layer(phase.expedition.layer)
    const station = phase.townQuest
      ? null
      : this.deps.catalog.station(phase.expedition.layer, phase.expedition.at)
    if (station?.rewardGoods) goods = Bag.add(goods, station.rewardGoods)
    if (layer && station)
      gold = Math.round(
        gold *
          this.deps.expedition.depthFactor(
            this.deps.expedition.depthRatio(layer, station),
            this.deps.catalog.data.balance.depth.gold
          )
      )
    // 敵は低い確率で武器をそのまま落とす（balance.weaponDrop・仮）。個体は鑑定と同じ抽選
    const dropped = this.#dropWeapons(state, battle, random, nextId)
    const members = state.members.map((member) =>
      state.party.includes(member.id)
        ? {
            ...member,
            exp:
              member.hp > 0 && !this.deps.catalog.member(member.id)?.hero
                ? member.exp + exp
                : member.exp,
            status: [],
          }
        : member
    )
    if (phase.townQuest) {
      const quest = this.deps.catalog.quest(phase.townQuest)!
      const totalGold = gold + quest.reward.gold
      const totalGoods = Bag.add(goods, quest.reward.goods)
      return accept(
        {
          ...state,
          members,
          gold: state.gold + totalGold,
          stones: state.stones + stones,
          bag: Bag.add(state.bag, totalGoods),
          gear: [...state.gear, ...dropped],
          quests: state.quests.map((entry) =>
            entry.id === quest.id
              ? { ...entry, progress: quest.count, claimed: true }
              : entry
          ),
          phase: { type: "town" },
        },
        ...events,
        {
          type: "victory",
          exp,
          gold: totalGold,
          goods: totalGoods,
          boss: false,
          ...(stones ? { stones } : {}),
          ...(dropped.length
            ? { weapons: dropped.map((gear) => gear.id) }
            : {}),
        },
        { type: "quest-claimed", quest: quest.id, gold: quest.reward.gold }
      )
    }
    const quests = state.quests.map((quest) => {
      const def = this.deps.catalog.quest(quest.id)
      if (!def || def.encounter || quest.claimed) return quest
      if (def.requiresCleared && !state.cleared) return quest
      if (def.requiresBossVictory && !battle.boss) return quest
      if (
        def.requiresFullPartyAlive &&
        (state.party.length !== PARTY_SLOTS ||
          state.party.some(
            (id) =>
              !state.members.some((member) => member.id === id && member.hp > 0)
          ))
      )
        return quest
      const hits = battle.foes.filter((foe) => foe.foe === def.foe).length
      return { ...quest, progress: Math.min(def.count, quest.progress + hits) }
    })
    const layerIndex = this.deps.catalog.layerIndex(phase.expedition.layer)
    const opened =
      battle.boss && layerIndex + 1 < this.deps.catalog.data.layers.length
        ? this.deps.catalog.data.layers[layerIndex + 1].id
        : null
    // 最後の層のボスを倒すと踏破（クリア）。踏破後も遊べる
    const cleared =
      battle.boss && layerIndex === this.deps.catalog.data.layers.length - 1
    const all: GameEvent[] = [
      ...events,
      {
        type: "victory",
        exp,
        gold,
        goods,
        boss: battle.boss,
        ...(stones > 0 ? { stones } : {}),
        ...(dropped.length ? { weapons: dropped.map((gear) => gear.id) } : {}),
      },
    ]
    if (battle.boss)
      all.push({ type: "layer-cleared", layer: phase.expedition.layer, opened })
    if (cleared && !state.cleared)
      all.push({ type: "game-cleared", layer: phase.expedition.layer })
    const expedition = {
      ...phase.expedition,
      cleared: phase.expedition.cleared || battle.boss,
      pending: {
        kind: "loot" as const,
        gold,
        goods,
        boss: battle.boss,
        stones,
        ...(dropped.length ? { weapons: dropped.map((gear) => gear.id) } : {}),
      },
      loot: {
        gold: phase.expedition.loot.gold + gold,
        goods: Bag.add(phase.expedition.loot.goods, goods),
        ...(dropped.length || phase.expedition.loot.weapons
          ? {
              weapons: [
                ...(phase.expedition.loot.weapons ?? []),
                ...dropped.map((gear) => gear.id),
              ],
            }
          : {}),
      },
    }
    return accept(
      {
        ...state,
        members,
        quests,
        gold: state.gold + gold,
        stones: state.stones + stones,
        bag: Bag.add(state.bag, goods),
        gear: [...state.gear, ...dropped],
        reached: opened
          ? Math.max(state.reached, layerIndex + 1)
          : state.reached,
        cleared: state.cleared || cleared,
        phase: { type: "expedition", expedition },
      },
      ...all
    )
  }

  /** 倒した敵ごとに、balance.weaponDrop.chance の確率で武器の個体を一つ落とす。 */
  #dropWeapons(
    state: GameState,
    battle: Battle,
    random: Random,
    nextId: () => string
  ): Gear[] {
    const { catalog, weapons } = this.deps
    const chance = catalog.data.balance.weaponDrop?.chance ?? 0
    if (chance <= 0) return []
    const pool = catalog.weaponDropPool(state.reached)
    if (!pool.length) return []
    const dropped: Gear[] = []
    for (const _ of battle.foes) {
      if (random() >= chance) continue
      const good = catalog.good(
        pickWeighted(random, pool, (id) =>
          catalog.appraisalWeight(id, state.reached)
        )
      )
      if (!good) continue
      dropped.push({
        id: nextId(),
        good: good.id,
        owner: null,
        unidentified: true,
        plus: between(
          random,
          0,
          Math.min(
            2,
            state.reached + 1,
            catalog.data.smithy?.upgrades.length ?? 0
          )
        ),
        progress: 0,
        wear: 0,
        weapon: weapons.roll(good, random, state.reached),
      })
    }
    return dropped
  }
}

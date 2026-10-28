import { Bag } from "@/lib/wiz/rules/bag"
import { BlessingRules } from "@/lib/wiz/rules/blessing-rules"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState, Stack } from "@/lib/wiz/state/state-schema"
import { accept } from "@/lib/wiz/application/accept"
import type { Transition } from "@/lib/wiz/application/transition"

/**
 * 全滅（仮ルール）：この探索で得た金貨と拾った物（落とした武器を含む）を失い、経験値は残る。
 * ガラクタ（光るガラクタを含む）だけは `balance.wipe.keepJunk` の割合（切り上げ）を持ち帰れる。
 * 仲間は死なず、HP1で街へ戻る。失った物は `wipe` に残し、街で結果を見せる。
 */
export function defeat(
  state: GameState,
  expedition: {
    layer: string
    loot: {
      gold: number
      goods: readonly Stack[]
      weapons?: readonly string[]
    }
  },
  events: GameEvent[],
  /** 全滅しても一部を持ち帰れる品物（ガラクタ）と、その割合（切り上げ）。 */
  keep: { goods: readonly string[]; ratio: number } = { goods: [], ratio: 0 }
): Transition {
  const { loot } = expedition
  let bag = state.bag
  const lost: Stack[] = []
  const kept: Stack[] = []
  // 保存内の束の分かれ方で、切り上げや持ち帰り表示の個数を変えない。
  for (const entry of Bag.add([], loot.goods)) {
    const have = Bag.count(bag, entry.good)
    const picked = Math.min(have, entry.count)
    // ガラクタだけは割合ぶん（切り上げ）持ち帰れる。始めたてに何も残らない出撃を減らす
    const saved = keep.goods.includes(entry.good)
      ? Math.ceil(picked * keep.ratio)
      : 0
    const count = picked - saved
    if (saved > 0) kept.push({ good: entry.good, count: saved })
    if (count > 0) lost.push({ good: entry.good, count })
    bag = Bag.remove(bag, entry.good, count) ?? bag
  }
  // この探索で落とした武器の個体も失う。失った物には品物として残す
  const unidentifiedWeapons: Stack[] = []
  const dropped = new Set(loot.weapons ?? [])
  for (const gear of state.gear)
    if (dropped.has(gear.id) && !gear.owner)
      (gear.unidentified ? unidentifiedWeapons : lost).push({
        good: gear.good,
        count: 1,
      })
  const gear = state.gear.filter(
    (entry) => !dropped.has(entry.id) || !!entry.owner
  )
  const members = BlessingRules.clear(state).map((member) =>
    state.party.includes(member.id)
      ? { ...member, hp: Math.max(1, member.hp), status: [] }
      : member
  )
  const gold = Math.min(state.gold, loot.gold)
  return accept(
    {
      ...state,
      members,
      bag,
      gear,
      gold: state.gold - gold,
      wipe: {
        layer: expedition.layer,
        gold,
        goods: lost,
        ...(unidentifiedWeapons.length
          ? { unidentifiedWeapons: Bag.add([], unidentifiedWeapons) }
          : {}),
        ...(kept.length ? { kept } : {}),
      },
      phase: { type: "town" },
    },
    ...events,
    { type: "defeated" }
  )
}

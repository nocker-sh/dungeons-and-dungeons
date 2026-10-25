import { PARTY_SLOTS } from "@/lib/wiz/content"
import type { GameDefinition } from "@/lib/wiz/definition"
import { createMember, starterGear } from "@/lib/wiz/members"
import type { GameState } from "@/lib/wiz/state"

/**
 * 遊べる街の状態。本物の「はじめから」は初期三人・ロクス契約済み・名前を決める場面なので、
 * 場面を組み立てるテストではこれを起点にする。
 * 最初に並ぶ募集の冒険者で出撃の3人をそろえ、街にいて最初の悪魔と契約済み。
 * 募集の値段は引かない（買い物のテストが所持金を自分で決められるようにするため）。
 * 募集の枠には、まだ雇っていない冒険者を並べ直す。
 */
export function startedState(definition: GameDefinition): GameState {
  const catalog = definition.catalog
  const data = catalog.data
  const initial = definition.initialState()
  const joining = data.recruiting.initial
    .map((id) => catalog.recruit(id))
    .filter((recruit) => recruit !== undefined)
    .slice(0, PARTY_SLOTS - initial.party.length)
  const joined = new Set([
    ...initial.members.map((member) => member.id),
    ...joining.map((recruit) => recruit.member.id),
  ])
  const board = data.recruits
    .filter((recruit) => !joined.has(recruit.member.id))
    .slice(0, data.recruiting.slots)
    .map((recruit) => recruit.id)
  let serial = initial.gear.length
  const nextId = () => `starter-${++serial}`
  const first = data.demons[0].id
  const state: GameState = {
    ...initial,
    // 施設・探索を検証する起点なので、ギルドでの名前登録も済んでいる。
    hero: { ...initial.hero, registrationPending: false },
    members: [
      ...initial.members,
      ...joining.map((recruit) => createMember(recruit.member)),
    ],
    party: [...initial.party, ...joining.map((recruit) => recruit.member.id)],
    gear: [
      ...initial.gear,
      ...joining.flatMap((recruit) =>
        starterGear(recruit.member, nextId, definition.rules.weapons)
      ),
    ],
    recruited: [...initial.recruited, ...joining.map((recruit) => recruit.id)],
    board,
    demons: [{ id: first, lv: 1, exp: 0 }],
    contract: first,
    phase: { type: "town" },
  }
  return {
    ...state,
    members: state.members.map((member) => ({
      ...member,
      hp: definition.rules.party.stats(member, state).maxHp,
    })),
  }
}

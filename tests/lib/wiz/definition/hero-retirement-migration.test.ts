import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { createMember } from "@/lib/wiz/members/create-member"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import type { GameState } from "@/lib/wiz/state/state-schema"

const definition = new GameDefinition(catalogOf(realContent()))
const hero = definition.catalog.data.party[0]
const [alda, mort, mayu] = ["alda", "mort", "mayu"].map(contentId)

/** プレイヤーが仲間として戦っていた頃の保存（プレイヤー・アルダ・モート）。 */
function oldSave(patch: (state: GameState) => GameState = (state) => state) {
  const base = aState().build()
  const members = base.members.filter((member) => member.id !== mayu)
  return patch({
    ...base,
    members: [createMember(hero), ...members],
    party: [hero.id, alda, mort],
    recruited: base.recruited.filter(
      (id) => definition.catalog.recruit(id)?.member.id !== mayu
    ),
    gear: base.gear.filter((gear) => gear.owner !== mayu),
    chatted: [hero.id],
  })
}

function load(snapshot: GameState) {
  const game = createTestGame()
  const save = game.save()
  const failed = game.restore({ ...save, snapshot } as typeof save)
  return { game, failed }
}

describe("プレイヤーが戦っていた旧保存", () => {
  it("街の保存はプレイヤーを外し、マユを迎えて3人にする", () => {
    const { game, failed } = load(oldSave())
    expect(failed).toBeUndefined()
    expect(game.state.party).toEqual([alda, mort, mayu])
    expect(game.state.members.some((member) => member.id === hero.id)).toBe(
      false
    )
    expect(game.state.chatted).toEqual([])
    expect(game.state.gear.some((gear) => gear.owner === mayu)).toBe(true)
    // 移行後の保存はそのまま読み直せる
    expect(game.restore(game.save())).toBeUndefined()
  })

  it("プレイヤーの手番で止まった戦闘は、次の仲間の手番から続ける（マユは控え）", () => {
    const state = oldSave((base) => {
      const battle = aState()
        .inBattle({ foes: ["kamokutsu"], order: ["foe-1", "alda", "mort"] })
        .build()
      if (battle.phase.type !== "battle") throw new Error()
      return {
        ...base,
        phase: {
          ...battle.phase,
          battle: {
            ...battle.phase.battle,
            order: [
              { kind: "member", id: hero.id },
              { kind: "foe", id: "foe-1" },
              { kind: "member", id: alda },
              { kind: "member", id: mort },
            ],
            turn: 0,
          },
        },
      }
    })
    const { game, failed } = load(state)
    expect(failed).toBeUndefined()
    if (game.state.phase.type !== "battle") throw new Error("not in battle")
    const { battle } = game.state.phase
    expect(battle.order.some((ref) => ref.id === hero.id)).toBe(false)
    expect(battle.order[battle.turn % battle.order.length]).toEqual({
      kind: "foe",
      id: "foe-1",
    })
    expect(game.state.party).toEqual([alda, mort])
    expect(game.state.members.some((member) => member.id === mayu)).toBe(true)
  })
})

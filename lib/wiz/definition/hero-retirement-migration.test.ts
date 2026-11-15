import { describe, expect, it } from "vite-plus/test"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { stateProblems } from "@/lib/wiz/integrity/state-problems"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { createMember } from "@/lib/wiz/members/create-member"

const catalog = catalogOf(realContent())
const [hero, alda, mayu, mort] = ["hero", "alda", "mayu", "mort"].map(
  contentId
)

describe("プレイヤーが戦っていた保存を移す", () => {
  it("マユが控えにいれば、プレイヤーの抜けた枠へ入れて3人で出撃できる", () => {
    // プレイヤー・アルダ・モートで出撃し、マユは控えにいた頃の保存
    const base = aState().build()
    const old: GameState = {
      ...base,
      members: [createMember(catalog.member(hero)!), ...base.members],
      party: [hero, alda, mort],
    }
    expect(old.members.some((member) => member.id === mayu)).toBe(true)
    const game = createTestGame()
    const save = JSON.parse(JSON.stringify(game.save()))
    expect(
      game.restore({ ...save, snapshot: JSON.parse(JSON.stringify(old)) })
    ).toBeUndefined()
    expect(game.state.party).toEqual([alda, mort, mayu])
    expect(stateProblems(game.state, catalog)).toEqual([])
  })
})

import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameActionOf } from "@/lib/wiz/commands"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"

const alda = memberBySlug("alda").id
const mort = memberBySlug("mort").id

function battle() {
  return createTestGame({
    state: aState()
      .withMember("mort", { hp: 1 })
      .withMember("alda", { hp: 0 })
      .inBattle({
        foes: ["kamokutsu", "kamokutsu"],
        order: ["mort", "foe-1", "foe-2", "hero"],
      })
      .build(),
    random: 0.5,
  })
}

describe("戦闘で明示した回復対象", () => {
  function rejectsWithoutSpending(
    game: ReturnType<typeof battle>,
    action: GameActionOf<"act">
  ) {
    const state = game.state
    const saved = game.save()
    const result = game.send(action)
    expect(result).toBeInstanceOf(GameCommandError)
    expect((result as GameCommandError).code).toBe("NO_TARGET")
    expect(game.state).toBe(state)
    expect(game.save()).toEqual(saved)
  }

  it.each([
    { slug: "grave-care", invalid: ["missing", "foe-1", alda], valid: mort },
    { slug: "grave-raise", invalid: ["missing", "foe-1", mort], valid: alda },
  ])(
    "$slug は指定した仲間に使えなければ回数・手番を消費しない",
    ({ slug, invalid, valid }) => {
      const game = battle()
      const skill = skillBySlug(slug).id
      for (const target of invalid) {
        rejectsWithoutSpending(game, {
          type: "act",
          command: "skill",
          skill,
          target,
        })
      }
      const acted = eventsOrThrow(
        game.send({ type: "act", command: "skill", skill, target: valid })
      ).find((event) => event.type === "acted")!
      expect(acted.results[0].target.id).toBe(valid)
    }
  )

  it.each([
    { slug: "grave-care", target: mort },
    { slug: "grave-raise", target: alda },
  ])(
    "$slug は対象を省略すると回復できる仲間を自動選択する",
    ({ slug, target }) => {
      const game = battle()
      const acted = eventsOrThrow(
        game.send({
          type: "act",
          command: "skill",
          skill: skillBySlug(slug).id,
        })
      ).find((event) => event.type === "acted")!
      expect(acted.results[0].target.id).toBe(target)
    }
  )
})

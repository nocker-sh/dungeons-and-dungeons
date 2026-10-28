import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import type { GameAction } from "@/lib/wiz/commands"

const potion = contentId("potion")
const ether = contentId("ether")
const bag = [
  { good: potion, count: 3 },
  { good: ether, count: 2 },
  { good: potion, count: 4 },
]
const base = () => aState().withBag(bag).withMember("alda", { hp: 1 })

describe("分かれた道具の束からの保存再開", () => {
  const cases = [
    {
      name: "出撃",
      state: () => base().build(),
      action: { type: "depart", layer: contentId("layer0") },
    },
    {
      name: "別の道具の持ち出し変更",
      state: () => base().build(),
      action: { type: "pack", good: ether, count: 1 },
    },
    {
      name: "探索中の使用",
      state: () => base().inExpedition().build(),
      action: { type: "use", good: potion, member: contentId("alda") },
    },
    {
      name: "戦闘中の使用",
      state: () =>
        base()
          .inBattle({
            foes: ["kamokutsu"],
            order: ["hero", "foe-1", "alda", "mort"],
          })
          .build(),
      action: {
        type: "act",
        command: "item",
        good: potion,
        target: contentId("alda"),
      },
    },
    {
      name: "街の依頼戦闘",
      state: () => base().build(),
      action: {
        type: "fight-quest",
        quest: realContent().quests.find(
          (quest) => quest.encounter?.reached === 0
        )!.id,
      },
    },
  ] satisfies {
    name: string
    state: ReturnType<typeof base>["build"]
    action: GameAction
  }[]
  it.each(cases)(
    "$name: 操作後も受け入れた保存を再開できる",
    ({ state, action }) => {
      const game = createTestGame({ state: state() })
      expect(game.state.provisions).toBeUndefined()
      expect(game.restore(game.save())).toBeUndefined()
      const before = game.queries.supplies(game.state)
      expect(before.count).toBe(8)
      eventsOrThrow(game.send(action))
      const saved = game.save()
      expect(game.restore(saved)).toBeUndefined()
      expect(game.save()).toEqual(saved)
      expect(
        new Set(game.state.provisions!.map((entry) => entry.good)).size
      ).toBe(game.state.provisions!.length)
      const count = action.type === "use" || action.type === "act" ? 6 : 7
      expect(
        game.state.bag
          .filter((entry) => entry.good === potion)
          .reduce((sum, entry) => sum + entry.count, 0)
      ).toBe(count)
    }
  )
})

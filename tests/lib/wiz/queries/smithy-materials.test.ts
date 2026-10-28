import { describe, expect, it, vi } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { Bag } from "@/lib/wiz/rules/bag"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

describe.each(["upgrade", "craft"] as const)(
  "%sの素材表示と支払い",
  (operation) => {
    it.each([2, 3, 4])("在庫%d個を合計3個の必要数と比較する", (count) => {
      const bone = contentId("bone")
      const materials = [
        { good: bone, count: 1 },
        { good: bone, count: 2 },
      ]
      const content = aContent()
        .withSmithy({
          upgrades: [{ gold: 10, materials }],
          recipes: [
            {
              id: "duplicate-materials",
              good: contentId("sword"),
              gold: 10,
              materials,
            },
          ],
        })
        .build()
      const state = aState(content)
        .withGold(100)
        .withGear([])
        .withEquipped("alda", "sword")
        .withBag([
          { good: bone, count: 1 },
          { good: bone, count: count - 1 },
        ])
        .build()
      const random = vi.fn(() => 0.5)
      const ids = vi.fn(() => "crafted-gear")
      const game = createTestGame({ content, state, random, ids })
      expect(game.restore(game.save())).toBeUndefined()
      random.mockClear()
      ids.mockClear()
      const saved = game.save()
      const row =
        operation === "upgrade"
          ? game.queries.smithyUpgrades(game.state)![0]!
          : game.queries.smithyRecipes(game.state)![0]!
      expect(row.ready).toBe(count >= 3)
      expect(row.missingMaterials).toBe(count < 3)
      expect(row.materials).toEqual([
        {
          good: bone,
          name: content.goods.find((good) => good.id === bone)!.name,
          count: 3,
          have: count,
        },
      ])
      expect(game.save()).toEqual(saved)
      expect(materials).toEqual([
        { good: bone, count: 1 },
        { good: bone, count: 2 },
      ])
      const action =
        operation === "upgrade"
          ? { type: "upgrade" as const, gear: state.gear[0]!.id }
          : { type: "craft" as const, recipe: "duplicate-materials" }
      const before = game.state
      const result = game.send(action)
      if (count < 3) {
        expect(result).toBeInstanceOf(GameCommandError)
        expect((result as GameCommandError).code).toBe("NO_MATERIALS")
        expect(game.state).toBe(before)
        expect(game.save()).toEqual(saved)
        expect(random).not.toHaveBeenCalled()
        expect(ids).not.toHaveBeenCalled()
      } else {
        eventsOrThrow(result)
        expect(game.state.gold).toBe(90)
        expect(Bag.count(game.state.bag, bone)).toBe(count - 3)
        if (operation === "upgrade") expect(game.state.gear[0]!.plus).toBe(1)
        else expect(game.state.gear).toHaveLength(state.gear.length + 1)
        expect(game.restore(game.save())).toBeUndefined()
      }
    })
  }
)

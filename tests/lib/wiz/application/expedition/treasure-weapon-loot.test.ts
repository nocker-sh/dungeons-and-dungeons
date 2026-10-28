import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"

describe("武器を拾った後の宝箱", () => {
  it.each(["retreat", "wipe"] as const)(
    "%s: 宝箱を続けて開けても武器の持ち帰り表示・保存・帰還の精算を保つ",
    (outcome) => {
      const content = aContent()
        .withBalance({ weaponDrop: { chance: 1 } })
        .withWeaponPower(400)
        .withFoe("kamokutsu", { atk: 9999, spd: 999 })
        .withStation("layer0", "n2", {
          event: "treasure",
          discovery: undefined,
        })
        .withStation("layer0", "n3", {
          event: "treasure",
          discovery: undefined,
        })
        .withStation("layer0", "n4", {
          event: "battle",
          foes: [contentId("kamokutsu")],
        })
        .build()
      let game = createTestGame({
        content,
        random: 0,
        state: aState(content)
          .inBattle({
            foes: ["kamokutsu"],
            order: ["hero", "alda", "mort", "foe-1"],
          })
          .build(),
      })
      const originalGear = game.state.gear.map((entry) => entry.id)
      fightToEnd(game)
      const weapons = game.queries.route(game.state)!.loot.weapons!
      expect(weapons).toHaveLength(1)
      const dropped = game.state.gear.find((entry) => entry.id === weapons[0])!
      expect(dropped.unidentified).toBe(true)
      eventsOrThrow(game.send({ type: "acknowledge" }))
      for (const to of ["n2", "n3"]) {
        const before = game.state.gear
        const events = eventsOrThrow(game.send({ type: "advance", to }))
        expect(events).toContainEqual(
          expect.objectContaining({ type: "treasure" })
        )
        expect(game.queries.route(game.state)!.loot.weapons).toEqual(weapons)
        expect(
          game.queries.carried(game.state)!.gear.map((entry) => entry.gear)
        ).toEqual(weapons)
        expect(game.state.gear).toEqual(before)
        const saved = game.save()
        const restored = createTestGame({ content, random: 0 })
        expect(restored.restore(saved)).toBeUndefined()
        expect(restored.save()).toEqual(saved)
        game = restored
        eventsOrThrow(game.send({ type: "acknowledge" }))
      }
      if (outcome === "retreat") {
        eventsOrThrow(game.send({ type: "retreat" }))
        expect(
          game.state.gear.find((entry) => entry.id === dropped.id)
        ).toEqual(dropped)
        expect(game.state.gear.map((entry) => entry.id)).toEqual([
          ...originalGear,
          ...weapons,
        ])
      } else {
        eventsOrThrow(game.send({ type: "advance", to: "n4" }))
        fightToEnd(game, "guard")
        expect(game.state.gear.map((entry) => entry.id)).toEqual(originalGear)
        expect(game.state.wipe?.unidentifiedWeapons).toContainEqual({
          good: dropped.good,
          count: 1,
        })
        expect(game.queries.result(game.state)?.goods).toContainEqual(
          expect.objectContaining({
            good: dropped.good,
            name: expect.stringMatching(/^だれかの/),
            count: 1,
          })
        )
      }
      expect(game.state.phase.type).toBe("town")
      expect(game.restore(game.save())).toBeUndefined()
    }
  )
})

import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"

function recovered() {
  const content = aContent()
    .withBalance({ weaponDrop: { chance: 1 } })
    .withWeaponPower(400)
    .build()
  const game = createTestGame({
    content,
    random: 0.9,
    state: aState(content)
      .inBattle({ foes: ["kamokutsu"] })
      .build(),
  })
  const victory = fightToEnd(game).find((event) => event.type === "victory")!
  const id = victory.type === "victory" ? victory.weapons![0] : ""
  const save = game.save()
  expect(
    game.restore({
      ...save,
      snapshot: { ...save.snapshot, phase: { type: "town" } },
    })
  ).toBeUndefined()
  return { game, id, content }
}

describe("前の持ち主の未鑑定武器", () => {
  it("[feature:W010] 保存後も未鑑定で、武器屋で同じ個体の強化・ワザを明かす。ガラクタ・金貨は不要", () => {
    const { game, id } = recovered()
    const weapon = game.state.gear.find((entry) => entry.id === id)!
    expect(weapon.plus).toBeGreaterThan(0)
    const saved = game.save()
    expect(game.restore(saved)).toBeUndefined()
    expect(
      game.queries.gear(game.state).find((entry) => entry.gear === id)
    ).toMatchObject({ stat: "未鑑定", weapon: null, rarity: null, plus: 0 })
    eventsOrThrow(
      game.send({ type: "appraise", shop: contentId("armory"), gear: id })
    )
    expect(game.state.gear.find((entry) => entry.id === id)).toEqual({
      ...weapon,
      unidentified: false,
    })
    expect(game.state.gold).toBe(saved.snapshot.gold)
    expect(game.state.bag).toEqual(saved.snapshot.bag)
    const known = game.queries
      .gear(game.state)
      .find((entry) => entry.gear === id)!
    expect(known.name).not.toMatch(/^だれかの/)
    expect(known.plus).toBe(weapon.plus)
    expect(known.weapon?.skills).toHaveLength(3)
    expect(game.queries.problems(game.state)).toEqual([])
    const once = game.save()
    expect(
      game.send({ type: "appraise", shop: contentId("armory"), gear: id })
    ).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(once)
  })
  it("[feature:W017] 鑑定前の装備・強化・売却・スキル変更や別の店の鑑定は拒否し、資産を保持する", () => {
    const { game, id } = recovered()
    const before = game.save()
    const weapon = game.state.gear.find((entry) => entry.id === id)!
    for (const command of [
      { type: "equip", gear: id, member: contentId("alda") },
      { type: "upgrade", gear: id },
      { type: "sell", gear: id },
      { type: "inscribe", gear: id, slot: 1, skill: weapon.weapon!.skills[1] },
      { type: "appraise", shop: contentId("tools"), gear: id },
    ] as const) {
      expect(game.send(command)).toBeInstanceOf(GameCommandError)
      expect(game.save()).toEqual(before)
    }
    expect(
      game.queries
        .equipOptions(game.state, contentId("alda"))
        .some((entry) => entry.gear === id)
    ).toBe(false)
    expect(game.queries.upgrades(game.state, id)).toEqual([])
    expect(
      game.queries.bestWeapons(game.state).some((entry) => entry.gear === id)
    ).toBe(false)
    expect(
      game.queries
        .sellables(game.state)
        .some((entry) => "gear" in entry && entry.gear === id)
    ).toBe(false)
    const forged = {
      ...before.snapshot,
      gear: before.snapshot.gear.map((entry) =>
        entry.id === id ? { ...entry, owner: contentId("alda") } : entry
      ),
    }
    expect(game.restore({ ...before, snapshot: forged })).toBeDefined()
    expect(game.save()).toEqual(before)
  })
})

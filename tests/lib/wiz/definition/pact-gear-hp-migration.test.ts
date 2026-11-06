import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { GameState, Gear } from "@/lib/wiz/state/state-schema"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"

const definition = new GameDefinition(realContent())
const alma = contentId("alma")
const alda = contentId("alda")
const vest = goodBySlug("gravekeeper-vest")
const maximum = memberBySlug("alma").stats.maxHp

/** 旧版で着ていた最大HPつきの防具。別の仲間の正常な装備とHPも残す。 */
function legacyState(hp: number, battle = false): GameState {
  const builder = aState().withJoined("alma", { replacing: "mort" })
  const base = battle
    ? builder
        .inBattle({
          foes: ["kamokutsu"],
          order: ["alma", "foe-1", "hero", "alda"],
        })
        .build()
    : builder.build()
  const armor = (owner: string): Gear => ({
    id: `old-vest-${owner}`,
    good: vest.id,
    owner,
    plus: 0,
    progress: 0,
    wear: 10,
    weapon: null,
  })
  const equipped = {
    ...base,
    gear: [
      ...base.gear.filter(
        (gear) =>
          gear.owner !== alda ||
          definition.catalog.good(gear.good)?.kind !== "armor"
      ),
      armor(alma),
      armor(alda),
    ],
  }
  return {
    ...equipped,
    members: equipped.members.map((member) =>
      member.id === alma
        ? { ...member, hp }
        : member.id === alda
          ? {
              ...member,
              hp: definition.rules.party.stats(member, equipped).maxHp,
            }
          : member
    ),
  }
}

describe.each([
  ["現在", definition.identity],
  ["直前", definition.previousIdentity],
  ["旧版", definition.legacyIdentity],
])("契約仲間の防具を外す保存移行: %s", (_label, contentVersion) => {
  it.each([0, 70, maximum, maximum + vest.bonus!.maxHp!])(
    "HP%dは移行後の上限内へ収め、ほかの仲間と資産を保持する",
    (hp) => {
      const game = createTestGame()
      const snapshot = legacyState(hp)
      const save = { ...game.save(), contentVersion, snapshot }
      const original = JSON.stringify(save)
      const input = JSON.parse(original)

      expect(game.restore(input)).toBeUndefined()
      const migrated = game.state.members.find((member) => member.id === alma)!
      expect(definition.rules.party.stats(migrated, game.state).maxHp).toBe(
        maximum
      )
      expect(game.queries.member(game.state, alma)).toMatchObject({
        hp: Math.min(hp, maximum),
        maxHp: maximum,
      })
      expect(game.state.members.filter((member) => member.id !== alma)).toEqual(
        snapshot.members.filter((member) => member.id !== alma)
      )
      expect(game.state.party).toEqual(snapshot.party)
      expect(game.state.gear).toEqual(
        snapshot.gear.map((gear) =>
          gear.owner === alma ? { ...gear, owner: null } : gear
        )
      )
      expect(game.state.gold).toBe(snapshot.gold)
      expect(game.state.stones).toBe(snapshot.stones)
      expect(game.state.bag).toEqual(snapshot.bag)
      expect(JSON.stringify(input)).toBe(original)
      expect(JSON.stringify(save)).toBe(original)
      const restored = createTestGame()
      expect(
        restored.restore(JSON.parse(JSON.stringify(game.save())))
      ).toBeUndefined()
      expect(restored.state).toEqual(game.state)
    }
  )
})

it("戦闘途中の旧防具も移行して、同じ仲間の手番を続けられる", () => {
  const game = createTestGame()
  const snapshot = legacyState(maximum + vest.bonus!.maxHp!, true)
  const save = JSON.parse(JSON.stringify({ ...game.save(), snapshot }))
  expect(game.restore(save)).toBeUndefined()
  expect(game.queries.member(game.state, alma)).toMatchObject({
    hp: maximum,
    maxHp: maximum,
  })
  expect(game.state.phase).toEqual(snapshot.phase)
  eventsOrThrow(game.send({ type: "act", command: "guard" }))
  expect(game.queries.member(game.state, alma)?.hp).toBe(maximum)
})

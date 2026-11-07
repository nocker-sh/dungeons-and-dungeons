import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { expect, test } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import type { GameState } from "@/lib/wiz/state/state-schema"

const [hero, alda, mayu, mort] = ["hero", "alda", "mayu", "mort"].map(contentId)

function legacyBattle(): GameState {
  const base = aState()
    .withJoined("mayu")
    .inBattle({
      foes: ["kamokutsu", "kamokutsu"],
      order: ["mort", "hero", "foe-1", "alda", "foe-2", "mayu"],
    })
    .build()
  return { ...base, party: [hero, alda, mayu, mort] }
}

test.each(["current", "previous", "legacy"] as const)(
  "benching the current legacy member skips a fallen member before resuming: %s",
  (version) => {
    const initial = legacyBattle()
    const saved = {
      ...initial,
      members: initial.members.map((member) =>
        member.id === hero ? { ...member, hp: 0 } : member
      ),
    }
    const definition = new GameDefinition(realContent())
    const contentVersion =
      version === "legacy"
        ? definition.legacyIdentity
        : version === "previous"
          ? definition.previousIdentity
          : definition.identity
    const snapshot =
      version === "legacy"
        ? {
            ...saved,
            gear: saved.gear.map((entry) =>
              entry.weapon
                ? {
                    ...entry,
                    weapon: {
                      ...entry.weapon,
                      skills: [
                        entry.weapon.skills[0],
                        realContent().skills.find(
                          (skill) => !entry.weapon!.skills.includes(skill.id)
                        )!.id,
                        ...entry.weapon.skills.slice(1),
                      ],
                    },
                  }
                : entry
            ),
          }
        : saved
    const original = structuredClone(snapshot)
    const game = createTestGame({ random: 0 })
    expect(
      game.restore({ ...game.save(), contentVersion, snapshot })
    ).toBeUndefined()
    expect(game.state.party).toEqual([hero, alda, mayu])
    expect(game.queries.battle(game.state)?.current).toEqual({
      kind: "foe",
      id: "foe-1",
    })
    eventsOrThrow(game.send({ type: "foe-turn" }))
    expect(snapshot).toEqual(original)
  }
)

test("benching the only living legacy member resolves defeat instead of leaving a dead turn", () => {
  const initial = legacyBattle()
  if (initial.phase.type !== "battle") throw new Error("Expected battle")
  const saved: GameState = {
    ...initial,
    gold: 100,
    members: initial.members.map((member) =>
      member.id !== mort ? { ...member, hp: 0 } : member
    ),
    phase: {
      ...initial.phase,
      expedition: { ...initial.phase.expedition, loot: { gold: 7, goods: [] } },
    },
  }
  const game = createTestGame({ random: 0 })
  expect(game.restore({ ...game.save(), snapshot: saved })).toBeUndefined()
  expect(game.state.phase.type).toBe("town")
  for (const id of [hero, alda, mayu])
    expect(game.state.members.find((member) => member.id === id)?.hp).toBe(1)
  expect(game.state.members.find((member) => member.id === mort)?.hp).toBe(
    initial.members.find((member) => member.id === mort)?.hp
  )
  expect(game.state.gold).toBe(93)
  expect(game.state.wipe?.gold).toBe(7)
  const resumed = createTestGame({ random: 0 })
  expect(
    resumed.restore(JSON.parse(JSON.stringify(game.save())))
  ).toBeUndefined()
  expect(resumed.state).toEqual(game.state)
})

test("migration applies bound turns, regeneration and poison before choosing the next living actor", () => {
  const initial = legacyBattle()
  if (initial.phase.type !== "battle") throw new Error("Expected battle")
  const saved: GameState = {
    ...initial,
    members: initial.members.map((member) =>
      member.id === hero
        ? {
            ...member,
            hp: 10,
            status: [
              { kind: "bind", turns: 1 },
              { kind: "regen", turns: 2 },
              { kind: "poison", turns: 2 },
            ],
          }
        : member.id === mort
          ? { ...member, status: [{ kind: "poison", turns: 2 }] }
          : member
    ),
    phase: {
      ...initial.phase,
      battle: {
        ...initial.phase.battle,
        guarding: [mort, alda],
        foes: initial.phase.battle.foes.map((foe) =>
          foe.id === "foe-1"
            ? {
                ...foe,
                hp: 1,
                status: [
                  { kind: "bind", turns: 1 },
                  { kind: "poison", turns: 2 },
                ],
              }
            : foe
        ),
      },
    },
  }
  const before = structuredClone(saved)
  const definition = new GameDefinition(realContent())
  const member = saved.members.find((entry) => entry.id === hero)!
  const maxHp = definition.rules.party.stats(member, saved).maxHp
  const expectedHp =
    Math.min(maxHp, member.hp + definition.rules.battle.regen(maxHp)) -
    definition.rules.battle.poison(maxHp)
  const game = createTestGame({ random: 0 })
  expect(game.restore({ ...game.save(), snapshot: saved })).toBeUndefined()
  expect(game.queries.battle(game.state)?.current).toEqual({
    kind: "member",
    id: alda,
  })
  expect(game.queries.battle(game.state)?.guarding).toEqual([alda])
  expect(game.state.members.find((entry) => entry.id === hero)).toMatchObject({
    hp: expectedHp,
    status: [
      { kind: "regen", turns: 1 },
      { kind: "poison", turns: 1 },
    ],
  })
  expect(game.state.members.find((entry) => entry.id === mort)).toEqual(
    saved.members.find((entry) => entry.id === mort)
  )
  expect(game.queries.battle(game.state)?.foes[0]).toMatchObject({
    hp: 0,
    status: [],
  })
  expect(game.state.gold).toBe(saved.gold)
  expect(game.state.bag).toEqual(saved.bag)
  expect(game.state.gear).toEqual(saved.gear)
  expect(saved).toEqual(before)
  const resumed = createTestGame({ random: 0 })
  expect(
    resumed.restore(JSON.parse(JSON.stringify(game.save())))
  ).toBeUndefined()
  expect(resumed.state).toEqual(game.state)
  eventsOrThrow(resumed.send({ type: "act", command: "guard" }))
  expect(resumed.queries.problems(resumed.state)).toEqual([])
})

test("a last enemy dying during migrated bound turns settles victory exactly once", () => {
  const initial = legacyBattle()
  if (initial.phase.type !== "battle") throw new Error("Expected battle")
  const saved: GameState = {
    ...initial,
    members: initial.members.map((member) =>
      member.id === hero
        ? { ...member, status: [{ kind: "bind", turns: 1 }] }
        : member.id === alda
          ? { ...member, hp: 0 }
          : member
    ),
    phase: {
      ...initial.phase,
      battle: {
        ...initial.phase.battle,
        foes: initial.phase.battle.foes.map((foe, index) => ({
          ...foe,
          hp: index === 0 ? 1 : 0,
          status:
            index === 0
              ? [
                  { kind: "bind", turns: 1 },
                  { kind: "poison", turns: 2 },
                ]
              : [],
        })),
      },
    },
  }
  const game = createTestGame({ random: 0 })
  expect(game.restore({ ...game.save(), snapshot: saved })).toBeUndefined()
  expect(game.state.phase.type).toBe("expedition")
  expect(game.queries.route(game.state)?.pending?.kind).toBe("loot")
  expect(game.state.gold).toBeGreaterThan(saved.gold)
  expect(
    game.state.members.some(
      (entry) =>
        entry.exp > saved.members.find((member) => member.id === entry.id)!.exp
    )
  ).toBe(true)
  const replay = createTestGame({ random: 0 })
  expect(replay.restore({ ...replay.save(), snapshot: saved })).toBeUndefined()
  expect(replay.state).toEqual(game.state)
  const resumed = createTestGame({ random: 0 })
  expect(
    resumed.restore(JSON.parse(JSON.stringify(game.save())))
  ).toBeUndefined()
  expect(resumed.state).toEqual(game.state)
  expect(resumed.send({ type: "foe-turn" })).toMatchObject({
    code: "WRONG_PHASE",
  })
  expect(resumed.state).toEqual(game.state)
  eventsOrThrow(resumed.send({ type: "acknowledge" }))
  expect(resumed.state.gold).toBe(game.state.gold)
  expect(resumed.state.bag).toEqual(game.state.bag)
  expect(resumed.state.gear).toEqual(game.state.gear)
})

for (const quest of realContent().quests.filter((entry) => entry.encounter))
  test(`${quest.id}: losing the last legacy combatant in a town quest returns without expedition losses`, () => {
    const base = aState()
      .withJoined("mayu")
      .withQuest(quest.id)
      .withReached(quest.encounter!.reached)
      .inBattle({
        foes: quest.encounter!.foes,
        order: [
          "mort",
          "hero",
          ...quest.encounter!.foes.map((_, index) => `foe-${index + 1}`),
          "alda",
          "mayu",
        ],
      })
      .build()
    if (base.phase.type !== "battle") throw new Error("Expected battle")
    const saved: GameState = {
      ...base,
      party: [hero, alda, mayu, mort],
      members: base.members.map((member) =>
        member.id === mort ? member : { ...member, hp: 0 }
      ),
      phase: { ...base.phase, townQuest: quest.id },
    }
    const game = createTestGame({ random: 0 })
    expect(game.restore({ ...game.save(), snapshot: saved })).toBeUndefined()
    expect(game.state.phase.type).toBe("town")
    expect(game.state.wipe).toEqual(saved.wipe)
    expect(game.state.gold).toBe(saved.gold)
    expect(game.state.bag).toEqual(saved.bag)
    expect(game.state.gear).toEqual(saved.gear)
    expect(game.state.quests).toEqual(saved.quests)
    for (const id of [hero, alda, mayu])
      expect(game.state.members.find((entry) => entry.id === id)?.hp).toBe(1)
    const resumed = createTestGame({ random: 0 })
    expect(
      resumed.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeUndefined()
    expect(resumed.state).toEqual(game.state)
    expect(resumed.queries.problems(resumed.state)).toEqual([])
  })

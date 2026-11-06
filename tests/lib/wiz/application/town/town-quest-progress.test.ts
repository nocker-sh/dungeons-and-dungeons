import { expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { realContent } from "@/lib/wiz/testing/real-content"

it("受注した本番の討伐依頼は、街の同じ敵を倒したときも一度だけ進む", () => {
  const { game, definition } = createTestPlay()
  const hunt = contentId("q-mole")
  const town = contentId("q-town-crates")
  eventsOrThrow(game.send({ type: "accept-quest", quest: hunt }))
  const before = game.state
  eventsOrThrow(game.send({ type: "fight-quest", quest: town }))
  expect(game.state.quests.find((entry) => entry.id === hunt)?.progress).toBe(0)
  const battle = game.queries.battle(game.state)!
  eventsOrThrow(
    game.send(
      battle.current.kind === "member"
        ? { type: "act", command: "guard" }
        : { type: "foe-turn" }
    )
  )
  expect(game.state.quests.find((entry) => entry.id === hunt)?.progress).toBe(0)
  const resumed = definition.create(testEnvironment())
  expect(
    resumed.restore(JSON.parse(JSON.stringify(game.save())))
  ).toBeUndefined()
  const events = fightToEnd(resumed)
  const victory = events.find((entry) => entry.type === "victory")
  expect(victory).toBeDefined()
  expect(resumed.state.quests.find((entry) => entry.id === hunt)).toEqual({
    id: hunt,
    progress: 1,
    claimed: false,
  })
  expect(resumed.state.quests.find((entry) => entry.id === town)).toEqual({
    id: town,
    progress: 1,
    claimed: true,
  })
  if (victory?.type !== "victory") throw new Error("勝利していない")
  expect(resumed.state.gold).toBe(before.gold + victory.gold)
  expect(events.filter((entry) => entry.type === "quest-claimed")).toEqual([
    {
      type: "quest-claimed",
      quest: town,
      gold: definition.catalog.quest(town)!.reward.gold,
    },
  ])
  const saved = resumed.save()
  for (const action of [
    { type: "fight-quest", quest: town },
    { type: "foe-turn" },
    { type: "claim-quest", quest: hunt },
  ] as const) {
    expect(resumed.send(action)).toBeInstanceOf(GameCommandError)
    expect(resumed.save()).toEqual(saved)
  }
  expect(resumed.restore(JSON.parse(JSON.stringify(saved)))).toBeUndefined()
  expect(resumed.save()).toEqual(saved)
})

it.each(["受注前", "別の敵"])(
  "%sの討伐依頼は街の勝利で増やさない",
  (condition) => {
    const { game } = createTestPlay()
    const hunt = contentId(condition === "受注前" ? "q-mole" : "q-skeleton")
    if (condition === "別の敵")
      eventsOrThrow(game.send({ type: "accept-quest", quest: hunt }))
    eventsOrThrow(
      game.send({ type: "fight-quest", quest: contentId("q-town-crates") })
    )
    expect(fightToEnd(game).some((event) => event.type === "victory")).toBe(
      true
    )
    if (condition === "受注前")
      eventsOrThrow(game.send({ type: "accept-quest", quest: hunt }))
    expect(game.state.quests.find((entry) => entry.id === hunt)?.progress).toBe(
      0
    )
  }
)

it.each([false, true])(
  "達成数を越えず、報告済みの討伐も戻さない: claimed=%s",
  (claimed) => {
    const { game: accepted, definition } = createTestPlay()
    const hunt = contentId("q-mole")
    eventsOrThrow(accepted.send({ type: "accept-quest", quest: hunt }))
    const count = definition.catalog.quest(hunt)!.count
    const game = definition.create(testEnvironment(), {
      ...accepted.state,
      quests: accepted.state.quests.map((entry) => ({
        ...entry,
        progress: count,
      })),
    })
    if (claimed) eventsOrThrow(game.send({ type: "claim-quest", quest: hunt }))
    const quest = game.state.quests.find((entry) => entry.id === hunt)
    eventsOrThrow(
      game.send({ type: "fight-quest", quest: contentId("q-town-crates") })
    )
    expect(fightToEnd(game).some((event) => event.type === "victory")).toBe(
      true
    )
    expect(game.state.quests.find((entry) => entry.id === hunt)).toEqual(quest)
  }
)

it("ボス勝利が条件の討伐は、街の通常戦闘では増やさない", () => {
  const content = realContent()
  const hunt = contentId("q-mole")
  const { game } = createTestPlay(0.5, {
    ...content,
    quests: content.quests.map((entry) =>
      entry.id === hunt ? { ...entry, requiresBossVictory: true } : entry
    ),
  })
  eventsOrThrow(game.send({ type: "accept-quest", quest: hunt }))
  eventsOrThrow(
    game.send({ type: "fight-quest", quest: contentId("q-town-crates") })
  )
  expect(fightToEnd(game).some((event) => event.type === "victory")).toBe(true)
  expect(game.state.quests.find((entry) => entry.id === hunt)?.progress).toBe(0)
})

it.each([false, true])(
  "勝利時の全員生存条件を街の戦闘でも守る: required=%s",
  (required) => {
    const content = realContent()
    const hunt = contentId("q-mole")
    const { game: ready, definition } = createTestPlay(0.5, {
      ...content,
      quests: content.quests.map((entry) =>
        entry.id === hunt
          ? { ...entry, requiresFullPartyAlive: required }
          : entry
      ),
    })
    const hero = definition.catalog.data.party.find((member) => member.hero)!.id
    const game = definition.create(testEnvironment(), {
      ...ready.state,
      members: ready.state.members.map((member) =>
        member.id === hero
          ? { ...member, hp: 1, status: [{ kind: "poison", turns: 1 }] }
          : {
              ...member,
              hp: 5000,
              stats: { ...member.stats, maxHp: 5000, str: 1000, tec: 1000 },
            }
      ),
    })
    eventsOrThrow(game.send({ type: "accept-quest", quest: hunt }))
    eventsOrThrow(
      game.send({ type: "fight-quest", quest: contentId("q-town-crates") })
    )
    for (
      let turn = 0;
      game.state.members.every((member) => member.hp > 0);
      turn++
    ) {
      expect(turn).toBeLessThan(100)
      const battle = game.queries.battle(game.state)!
      eventsOrThrow(
        game.send(
          battle.current.kind === "member"
            ? { type: "act", command: "guard" }
            : { type: "foe-turn" }
        )
      )
    }
    expect(game.state.phase.type).toBe("battle")
    expect(fightToEnd(game).some((event) => event.type === "victory")).toBe(
      true
    )
    expect(game.state.quests.find((entry) => entry.id === hunt)?.progress).toBe(
      required ? 0 : 1
    )
  }
)

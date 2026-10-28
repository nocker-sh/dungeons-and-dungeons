import { expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { previews } from "@/development/scenarios/index"
import { createStudioStart } from "@/development/studio/create-studio-start"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"

const scenarios = [
  {
    name: "通常プレビュー",
    start: () =>
      previews()
        .find((entry) => entry.slug === "room-growth")!
        .start(),
  },
  ...["room-growth", "room-levelup"].flatMap((scene) =>
    [
      ["hero", "alda", "mort"],
      ["hero", "rivet", "husky"],
    ].map((party) => ({
      name: `${scene}/${party.join(",")}`,
      start: () => createStudioStart(parseStudioConfig({ scene, party })),
    }))
  ),
]

it.each(scenarios)("$name は編成した仲間が実際に1段階成長する", ({ start }) => {
  const preview = start()
  const game = new GameDefinition(preview.content!).create(
    preview.environment,
    preview.initialState
  )
  expect(game.restore(preview.save)).toBeUndefined()
  const party = game.queries.party(game.state)
  const target = party.find((member) => !member.hero)!
  expect(
    party.filter((member) => member.levelUpReady).map((member) => member.id)
  ).toEqual([target.id])
  expect(
    game.state.members.find((member) => member.id === target.id)?.exp
  ).toBe(target.next)
  const hero = party.find((member) => member.hero)!
  expect(game.state.members.find((member) => member.id === hero.id)?.exp).toBe(
    0
  )
  const screen = preview.screen
  if (screen?.name !== "room") throw new Error("宿のプレビューではありません")
  const room = game.queries
    .rooms(game.state)
    .find((entry) => entry.id === screen.room)!
  expect(room.levelUp).toBe(true)
  expect(room.affordable).toBe(true)
  const before = game.save()
  const events = eventsOf(inPhase(game, "town")?.rest(room.id))
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "rested",
      levelUps: [
        expect.objectContaining({
          member: target.id,
          from: target.lv,
          to: target.lv + 1,
        }),
      ],
    })
  )
  expect(game.state.gold).toBe(before.snapshot.gold - room.price)
  for (const member of game.state.members) {
    const previous = before.snapshot.members.find(
      (entry) => entry.id === member.id
    )!
    expect(member.lv).toBe(previous.lv + (member.id === target.id ? 1 : 0))
    expect(member.exp).toBe(0)
  }
})

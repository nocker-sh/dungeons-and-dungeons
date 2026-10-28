import { expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"

const idOf = (slug: string) => memberBySlug(slug).id

it.each([
  ["dungeon-blessing-1", []],
  ["dungeon-blessing-2", ["mort", "hero"]],
  ["dungeon-blessing-3", ["mort", "hero"]],
  ["dungeon-blessing-4", ["alda"]],
  ["dungeon-blessing-5", ["mort", "hero"]],
] as const)("%sの対象は実際に効く隊員だけを隊列順に返す", (slug, expected) => {
  const skill = skillBySlug(slug)
  const state = aState()
    .withMember("mort", { blessing: skill.id })
    .withMember("alda", { hp: 0 })
    .withExtraMember("rivet", { hp: 0 })
    .withExtraMember("husky", { hp: 1 })
    .withParty(["mort", "hero", "alda"])
    .inBattle({ foes: ["kamokutsu"], order: ["mort", "foe-1"] })
    .build()
  const probe = createTestGame({ state })
  const view = probe.queries.commands(state, idOf("mort"))!.blessing!
  expect(view.targets).toEqual(expected.map(idOf))

  if (skill.target === "allies") {
    const events = eventsOrThrow(
      probe.send({ type: "act", command: "skill", skill: skill.id })
    )
    expect(
      events
        .find((event) => event.type === "acted")
        ?.results.map((result) => result.target.id)
    ).toEqual(expected.map(idOf))
  }
  if (skill.target !== "ally") return
  for (const slug of ["mort", "hero", "alda", "rivet", "husky"]) {
    const game = createTestGame({ state })
    const result = game.send({
      type: "act",
      command: "skill",
      skill: skill.id,
      target: idOf(slug),
    })
    if (!expected.some((target) => target === slug)) {
      expect(result, slug).toBeInstanceOf(GameCommandError)
      expect(game.state).toEqual(state)
      continue
    }
    const event = eventsOrThrow(result).find((event) => event.type === "acted")
    expect(
      event?.results.map((result) => result.target.id),
      slug
    ).toEqual([idOf(slug)])
  }
})

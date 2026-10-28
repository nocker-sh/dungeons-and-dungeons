import { describe, expect, it } from "vite-plus/test"
import { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { startedState } from "@/lib/wiz/testing/started-state"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

describe("強化で増えるワザの使用回数", () => {
  const alda = memberBySlug("alda").id

  it("[feature:W023] 武器を強化すると最大の使用回数が増える", () => {
    const { definition } = createTestPlay()
    const base = GameStateBuilder.from(
      startedState(definition),
      definition.catalog
    )
      .withGold(2000)
      .withBag([{ good: contentId("bone"), count: 9 }])
      .withEquipped("alda", "greatsword")
      .build()
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      base
    )
    const weapon = game.state.gear.find(
      (gear) => gear.owner === alda && gear.good === contentId("greatsword")
    )!
    const before = game.queries.commands(game.state, alda)!.weaponSkills[0]
    const per = realContent().balance.weapon.usesPerPlus
    for (let step = 1; step < per; step++) {
      eventsOrThrow(game.send({ type: "upgrade", gear: weapon.id }))
      // usesPerPlus の段に届くまでは増えない
      expect(
        game.queries.commands(game.state, alda)!.weaponSkills[0].uses
      ).toBe(before.uses)
    }
    eventsOrThrow(game.send({ type: "upgrade", gear: weapon.id }))
    const after = game.queries.commands(game.state, alda)!.weaponSkills[0]
    expect(after.uses).toBe(before.uses! + 1)
    expect(after.left).toBe(before.left! + 1)
    const blessing = realContent().skills.find((skill) => skill.blessing)!
    const member = game.state.members.find((entry) => entry.id === alda)!
    expect(
      definition.rules.party.skills.maxUses(member, game.state, blessing.id)
    ).toBe(blessing.uses)
  })

  it("[feature:W004] 増えた分だけ多く使える", () => {
    const { definition } = createTestPlay()
    const base = GameStateBuilder.from(
      startedState(definition),
      definition.catalog
    )
      .withGold(2000)
      .withBag([{ good: contentId("bone"), count: 9 }])
      .withEquipped("alda", "greatsword")
      .build()
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      base
    )
    const weapon = game.state.gear.find(
      (gear) => gear.owner === alda && gear.good === contentId("greatsword")
    )!
    for (let step = 0; step < realContent().balance.weapon.usesPerPlus; step++)
      eventsOrThrow(game.send({ type: "upgrade", gear: weapon.id }))
    const skill = game.queries.commands(game.state, alda)!.weaponSkills[0]
    const used = { skill: skill.id, count: skill.uses! - 1 }
    const spent = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "y",
      }),
      {
        ...game.state,
        members: game.state.members.map((member) =>
          member.id === alda ? { ...member, used: [used] } : member
        ),
      }
    )
    expect(
      spent.queries.commands(spent.state, alda)!.weaponSkills[0].left
    ).toBe(1)
  })
})

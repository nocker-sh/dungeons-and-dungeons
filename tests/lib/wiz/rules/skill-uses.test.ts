import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { startedState } from "@/lib/wiz/testing/started-state"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameState } from "@/lib/wiz/state/state-schema"

describe("ワザの使用回数", () => {
  const mayu = memberBySlug("mayu").id
  const alda = memberBySlug("alda").id
  const bullet = skillBySlug("magicbullet")

  it("[feature:W004] ワザを使うと残りが減り、0になると使えない", () => {
    const game = createTestGame({
      state: aState()
        .inBattle({ order: ["mayu", "foe-1", "alda", "mort"] })
        .build(),
    })
    const left = () =>
      game.queries
        .commands(game.state, mayu)
        ?.weaponSkills.find((skill) => skill.id === bullet.id)?.left
    expect(left()).toBe(bullet.uses)
    eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: bullet.id })
    )
    expect(left()).toBe(bullet.uses! - 1)
    const spent: GameState = {
      ...game.state,
      members: game.state.members.map((member) =>
        member.id === mayu
          ? { ...member, used: [{ skill: bullet.id, count: bullet.uses! }] }
          : member
      ),
    }
    const dry = createTestPlay().definition.create(
      WizWorldEnvironment.create(),
      spent
    )
    expect(
      dry.queries
        .commands(dry.state, mayu)
        ?.weaponSkills.find((skill) => skill.id === bullet.id)?.usable
    ).toBe(false)
  })

  it("[feature:W007] 宿に泊まるとワザの残りが戻る", () => {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const used: GameState = {
      ...base,
      members: base.members.map((member) => ({
        ...member,
        used: [{ skill: contentId("focus"), count: 2 }],
      })),
    }
    const game = definition.create(WizWorldEnvironment.create(), used)
    eventsOrThrow(game.send({ type: "rest", room: contentId("normal") }))
    expect(game.state.members.every((member) => member.used.length === 0)).toBe(
      true
    )
  })

  it("[feature:W021] 気力の水はワザの残りを戻す", () => {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const whirl = contentId("whirl")
    const refill = 3
    const used: GameState = {
      ...base,
      bag: [...base.bag, { good: contentId("ether"), count: 1 }],
      members: base.members.map((member) =>
        member.id === alda
          ? { ...member, used: [{ skill: whirl, count: refill }] }
          : member
      ),
    }
    const game = definition.create(WizWorldEnvironment.create(), used)
    const events = eventsOrThrow(
      game.send({ type: "use", good: contentId("ether"), member: alda })
    )
    expect(events[0]).toMatchObject({ type: "used" })
    const effect = definition.catalog.good(contentId("ether"))?.effect
    const back = effect?.type === "refill" ? effect.uses : 0
    expect(
      game.state.members.find((member) => member.id === alda)?.used
    ).toEqual([{ skill: whirl, count: refill - back }])
  })
})

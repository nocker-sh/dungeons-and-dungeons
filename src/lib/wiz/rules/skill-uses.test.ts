import { describe, expect, it } from "vite-plus/test"
import {
  aState,
  createTestGame,
  contentId,
  createTestPlay,
  eventsOrThrow,
  memberBySlug,
  skillBySlug,
  startedState,
} from "@/lib/wiz/testing"
import { WizWorldEnvironment, type GameState } from "@/lib/wiz"

describe("ワザの使用回数", () => {
  const hero = memberBySlug("hero").id
  const alda = memberBySlug("alda").id
  const thrust = skillBySlug("thrust")

  it("[feature:W004] ワザを使うと残りが減り、0になると使えない", () => {
    const game = createTestGame({
      state: aState()
        .inBattle({ order: ["hero", "foe-1", "alda", "mort"] })
        .build(),
    })
    const left = () =>
      game.queries
        .commands(game.state, hero)
        ?.weaponSkills.find((skill) => skill.id === thrust.id)?.left
    expect(left()).toBe(thrust.uses)
    eventsOrThrow(
      game.send({ type: "act", command: "skill", skill: thrust.id })
    )
    expect(left()).toBe(thrust.uses! - 1)
    const spent: GameState = {
      ...game.state,
      members: game.state.members.map((member) =>
        member.id === hero
          ? { ...member, used: [{ skill: thrust.id, count: thrust.uses! }] }
          : member
      ),
    }
    const dry = createTestPlay().definition.create(
      WizWorldEnvironment.create(),
      spent
    )
    expect(
      dry.queries
        .commands(dry.state, hero)
        ?.weaponSkills.find((skill) => skill.id === thrust.id)?.usable
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
    const focus = contentId("focus")
    const refill = 3
    const used: GameState = {
      ...base,
      bag: [...base.bag, { good: contentId("ether"), count: 1 }],
      members: base.members.map((member) =>
        member.id === alda
          ? { ...member, used: [{ skill: focus, count: refill }] }
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
    ).toEqual([{ skill: focus, count: refill - back }])
  })
})

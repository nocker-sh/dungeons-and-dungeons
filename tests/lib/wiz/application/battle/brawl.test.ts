import { describe, expect, it } from "vite-plus/test"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { startedState } from "@/lib/wiz/testing/started-state"
import { turnActionFor } from "@/lib/wiz/testing/turn-action-for"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameState } from "@/lib/wiz/state/state-schema"

describe("殴る（使える手が尽きたとき）", () => {
  const alda = memberBySlug("alda").id

  /** アルダの攻撃できるワザをすべて使い切った状態で戦闘に入る。 */
  const dryBattle = () => {
    const { definition, game: probe } = createTestPlay()
    const base = startedState(definition)
    const view = probe.queries.commands(base, alda)!
    const empty = [...view.weaponSkills, ...view.skills]
      .filter((skill) => skill.kind === "hit" && skill.uses !== null)
      .map((skill) => ({ skill: skill.id, count: skill.uses! }))
    const state: GameState = {
      ...base,
      members: base.members.map((member) =>
        member.id === alda ? { ...member, used: empty } : member
      ),
    }
    const game = definition.create(
      WizWorldEnvironment.create({ random: () => 0.5, now: () => 0 }),
      state
    )
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    return { game, spent: empty.length }
  }

  it("[feature:W004] 攻撃できるワザが残っている間は「殴る」を選べない", () => {
    const { game } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    expect(game.queries.commands(game.state, alda)?.brawl).toBeNull()
    expect(
      (game.send({ type: "act", command: "brawl" }) as GameCommandError).code
    ).toBe("UNAVAILABLE")
  })

  it("[feature:W004] 尽きると「殴る」が出て、回数なしで使える", () => {
    const { game, spent } = dryBattle()
    expect(
      game.queries
        .commands(game.state, alda)
        ?.weaponSkills.every((skill) => skill.kind !== "hit" || !skill.usable)
    ).toBe(true)
    expect(game.queries.commands(game.state, alda)?.brawl?.name).toBe("殴る")
    // アルダの手番まで進める
    for (let guard = 0; guard < 10; guard++) {
      const view = game.queries.battle(game.state)!
      if (view.current.kind === "member" && view.current.id === alda) break
      eventsOrThrow(
        game.send(
          view.current.kind === "foe"
            ? { type: "foe-turn" }
            : turnActionFor(game, view.current.id)
        )
      )
    }
    const events = eventsOrThrow(game.send({ type: "act", command: "brawl" }))
    expect(events[0]).toMatchObject({
      type: "acted",
      command: "brawl",
      name: "殴る",
    })
    // 使用回数は減らない
    expect(
      game.state.members.find((member) => member.id === alda)?.used
    ).toHaveLength(spent)
  })

  it.each(["HP1", "代償と同じHP", "代償より1多いHP"])(
    "[feature:W004] 残る攻撃のHP代償を払えるかで殴るを決める（%s）",
    (boundary) => {
      const hero = memberBySlug("hero").id
      const builder = aState().withDemons([{ id: "zaza", lv: 1, exp: 0 }])
      const state = builder
        .inBattle({ order: [...builder.build().party, "foe-1"] })
        .build()
      const probe = createTestGame({ state })
      const commands = probe.queries.commands(probe.state, hero)!
      const attacks = [...commands.weaponSkills, ...commands.skills].filter(
        (skill) => skill.kind === "hit"
      )
      const sacrifice = attacks.find((skill) => skill.cost > 0)!
      expect(sacrifice.left).toBeGreaterThan(0)
      const used = attacks
        .filter((skill) => skill.cost === 0)
        .map((skill) => ({ skill: skill.id, count: skill.uses! }))
      const hp =
        boundary === "HP1"
          ? 1
          : sacrifice.cost + (boundary === "代償より1多いHP" ? 1 : 0)
      const game = createTestGame({
        state: {
          ...state,
          members: state.members.map((member) =>
            member.id === hero ? { ...member, hp, used } : member
          ),
        },
      })
      const view = game.queries.commands(game.state, hero)!
      const canAttack = hp > sacrifice.cost
      expect(
        [...view.weaponSkills, ...view.skills].some(
          (skill) => skill.kind === "hit" && skill.usable
        )
      ).toBe(canAttack)
      expect(view.brawl !== null).toBe(!canAttack)
      if (canAttack) {
        const before = game.state
        expect(game.send({ type: "act", command: "brawl" })).toMatchObject({
          code: "UNAVAILABLE",
        })
        expect(game.state).toBe(before)
        const acted = eventsOrThrow(
          game.send({
            type: "act",
            command: "skill",
            skill: sacrifice.id,
          })
        ).find((event) => event.type === "acted")
        expect(acted).toMatchObject({ paid: sacrifice.cost })
      } else {
        const acted = eventsOrThrow(
          game.send({
            type: "act",
            command: "brawl",
          })
        ).find((event) => event.type === "acted")
        expect(acted).toMatchObject({ command: "brawl" })
        expect(
          game.state.members.find((member) => member.id === hero)
        ).toMatchObject({ hp, used })
      }
    }
  )
})

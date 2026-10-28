import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import type { GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

const idOf = (slug: string) => memberBySlug(slug).id
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { Game } from "@/lib/wiz/game/game"
import type { GameAction } from "@/lib/wiz/commands"
import type { GameContent } from "@/lib/wiz/content/content-schema"
import type { GameEvent } from "@/lib/wiz/state/game-event"

/** 断られた理由。受け付けてしまったら分かるように投げる。 */
function reasonOf(game: Game, action: GameAction) {
  const result = game.send(action)
  if (!(result instanceof GameCommandError))
    throw new Error(`受け付けてしまった: ${JSON.stringify(action)}`)
  return result.code
}

/** 断られても状態がそのままか。 */
function rejectsWithoutChange(game: Game, action: GameAction) {
  const before = game.state
  const code = reasonOf(game, action)
  expect(game.state).toBe(before)
  return code
}

function actedOf(events: readonly GameEvent[]) {
  const acted = events.find((event) => event.type === "acted")
  if (acted?.type !== "acted") throw new Error("行動の出来事がない")
  return acted
}

describe("戦闘の指示の受け付け（hunt）", () => {
  const base = aContent().build()
  const alda = idOf("alda")
  const mort = idOf("mort")
  const hero = idOf("hero")
  /** アルダの素の武器（両手剣）に付くワザ。 */
  const whirl = skillBySlug("whirl")
  const charge = skillBySlug("charge")
  /** 倒れも倒されもしない相手（長く手番を回すため）。 */
  const dummyFoe = aContent(base)
    .withFoe("kamokutsu", { hp: 100000, atk: 1 })
    .build()

  function battle(
    options: {
      content?: GameContent
      order?: readonly string[]
      random?: number
      patch?: (builder: GameStateBuilder) => GameStateBuilder
    } = {}
  ) {
    const content = options.content ?? dummyFoe
    const builder = options.patch
      ? options.patch(aState(content))
      : aState(content)
    const state = builder
      .withWeaponSkills("alda", ["whirl", "helmsplit"])
      .inBattle({
        foes: ["kamokutsu"],
        order: options.order ?? ["alda", "hero", "mort", "foe-1"],
      })
      .build()
    return createTestGame({ content, state, random: options.random ?? 0.5 })
  }

  /** アルダの攻撃できるワザを、残らず使い切った記録。 */
  const spentHits = (content = dummyFoe) => {
    const probe = battle({ content, order: ["alda", "foe-1"] })
    const view = probe.queries.commands(probe.state, alda)!
    return [...view.weaponSkills, ...view.skills]
      .filter((skill) => skill.kind === "hit" && skill.uses !== null)
      .map((skill) => ({ skill: skill.id, count: skill.uses! }))
  }

  it("[feature:W004] 敵の手番に仲間の指示を送っても断られ、状態も袋も変わらない", () => {
    const game = battle({ order: ["foe-1", "alda", "hero", "mort"] })
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "skill",
        skill: whirl.id,
      })
    ).toBe("NOT_YOUR_TURN")
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "item",
        good: contentId("potion"),
      })
    ).toBe("NOT_YOUR_TURN")
    expect(rejectsWithoutChange(game, { type: "act", command: "guard" })).toBe(
      "NOT_YOUR_TURN"
    )
  })

  it("[feature:W005] 仲間の手番に敵を動かそうとしても断られる", () => {
    const game = battle()
    expect(rejectsWithoutChange(game, { type: "foe-turn" })).toBe(
      "NOT_YOUR_TURN"
    )
  })

  it("[feature:W004] 倒れている仲間の手番では指示を出せない", () => {
    const game = battle({
      patch: (builder) => builder.withMember("alda", { hp: 0 }),
    })
    expect(rejectsWithoutChange(game, { type: "act", command: "guard" })).toBe(
      "NOT_YOUR_TURN"
    )
  })

  it("[feature:W004] 街では戦闘の指示を送れない", () => {
    const content = base
    const state = aState(content).inTown().build()
    const game = createTestGame({ content, state })
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "skill",
        skill: whirl.id,
      })
    ).toBe("WRONG_PHASE")
    expect(rejectsWithoutChange(game, { type: "foe-turn" })).toBe("WRONG_PHASE")
  })

  it("[feature:W004] 覚えていないワザ・ワザの指定がない指示は断られる", () => {
    const game = battle()
    // 「癒やしの祈り」はシオンのスキル
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "skill",
        skill: contentId("prayer"),
      })
    ).toBe("UNAVAILABLE")
    expect(rejectsWithoutChange(game, { type: "act", command: "skill" })).toBe(
      "UNAVAILABLE"
    )
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "skill",
        skill: "no-such-skill",
      })
    ).toBe("UNAVAILABLE")
  })

  it("[feature:W004] 残りが尽きたワザは断られ、使った回数も増えない", () => {
    const used = [{ skill: whirl.id, count: whirl.uses! }]
    const game = battle({
      patch: (builder) => builder.withUses("alda", used),
    })
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "skill",
        skill: whirl.id,
      })
    ).toBe("NO_USES")
    expect(
      game.state.members.find((member) => member.id === alda)?.used
    ).toEqual(used)
  })

  it("[feature:W004] 袋にない道具・効果のない道具は断られ、袋は変わらない", () => {
    const game = battle({
      content: aContent(dummyFoe)
        .withGood("rope", { effect: undefined })
        .build(),
      patch: (builder) =>
        builder.withBag([
          { good: contentId("rope"), count: 1 },
          { good: contentId("potion"), count: 1 },
        ]),
    })
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "item",
        good: contentId("ether"),
      })
    ).toBe("NO_ITEM")
    // 効果を外した検証用の道具は使えない（作品のロープには足止め効果がある）
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "item",
        good: contentId("rope"),
      })
    ).toBe("UNAVAILABLE")
    // 武器は道具ではない
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "item",
        good: contentId("sword"),
      })
    ).toBe("UNAVAILABLE")
    expect(game.state.bag).toEqual([
      { good: contentId("rope"), count: 1 },
      { good: contentId("potion"), count: 1 },
    ])
  })

  it("[feature:W004] 倒れた仲間がいなければ蘇生の道具は断られ、消費しない", () => {
    // 蘇生量を固定して、効く相手がいないときの拒否を確かめる
    const content = aContent(dummyFoe)
      .withGood("revive", { effect: { type: "revive", hp: 20 } })
      .build()
    const game = battle({
      content,
      patch: (builder) =>
        builder.withBag([{ good: contentId("revive"), count: 1 }]),
    })
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "item",
        good: contentId("revive"),
      })
    ).toBe("NO_EFFECT")
    expect(game.state.bag).toEqual([{ good: contentId("revive"), count: 1 }])
  })

  it("[feature:W004] ワザは一度で1回ずつ減り、使い切ると断られる", () => {
    const game = battle({ order: ["alda", "foe-1"] })
    const leftOf = () =>
      game.queries
        .commands(game.state, alda)
        ?.weaponSkills.find((skill) => skill.id === whirl.id)?.left
    expect(leftOf()).toBe(whirl.uses)
    for (let count = whirl.uses!; count > 0; count--) {
      eventsOrThrow(
        game.send({ type: "act", command: "skill", skill: whirl.id })
      )
      expect(leftOf()).toBe(count - 1)
      eventsOrThrow(game.send({ type: "foe-turn" }))
    }
    expect(leftOf()).toBe(0)
    expect(
      rejectsWithoutChange(game, {
        type: "act",
        command: "skill",
        skill: whirl.id,
      })
    ).toBe("NO_USES")
  })

  it("[feature:W004] 気力の水はワザの残りを2回ずつ戻し、戻した合計を返す", () => {
    const game = battle({
      order: ["mort", "foe-1"],
      patch: (builder) =>
        builder
          .withBag([{ good: contentId("ether"), count: 1 }])
          .withUses("alda", [
            { skill: whirl.id, count: whirl.uses! },
            { skill: charge.id, count: 1 },
          ]),
    })
    const acted = actedOf(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "item",
          good: contentId("ether"),
          target: alda,
        })
      )
    )
    const effect = game.queries.good(contentId("ether"))!.effect
    const per = effect?.type === "refill" ? effect.uses : 0
    expect(acted.results[0]).toMatchObject({
      target: { kind: "member", id: alda },
      refill: per + 1,
    })
    expect(
      game.state.members.find((member) => member.id === alda)?.used
    ).toEqual([{ skill: whirl.id, count: whirl.uses! - per }])
    expect(game.state.bag).toEqual([])
  })

  it("[feature:W004] 道具は一つだけ減り、最後の一つを使うと袋から消える", () => {
    const game = battle({
      order: ["alda", "foe-1"],
      patch: (builder) =>
        builder
          .withBag([{ good: contentId("potion"), count: 2 }])
          .withMember("mort", { hp: 10 }),
    })
    eventsOrThrow(
      game.send({ type: "act", command: "item", good: contentId("potion") })
    )
    expect(game.state.bag).toEqual([{ good: contentId("potion"), count: 1 }])
    eventsOrThrow(game.send({ type: "foe-turn" }))
    eventsOrThrow(
      game.send({ type: "act", command: "item", good: contentId("potion") })
    )
    expect(game.state.bag).toEqual([])
  })

  it("[feature:W004] 攻撃のワザが1回でも残っていれば殴れない", () => {
    const game = battle({
      order: ["alda", "foe-1"],
      patch: (builder) =>
        builder.withUses(
          "alda",
          spentHits().map((entry, index) =>
            index === 0 ? { ...entry, count: entry.count - 1 } : entry
          )
        ),
    })
    expect(game.queries.commands(game.state, alda)?.brawl).toBeNull()
    expect(rejectsWithoutChange(game, { type: "act", command: "brawl" })).toBe(
      "UNAVAILABLE"
    )
  })

  it("[feature:W004] 攻撃のワザが尽きると殴れて、何度でも使えて回数に残らない", () => {
    const spent = spentHits()
    const game = battle({
      order: ["alda", "foe-1"],
      patch: (builder) => builder.withUses("alda", spent),
    })
    expect(game.queries.commands(game.state, alda)?.brawl?.name).toBe("殴る")
    for (let round = 0; round < 3; round++) {
      const acted = actedOf(
        eventsOrThrow(game.send({ type: "act", command: "brawl" }))
      )
      expect(acted).toMatchObject({ command: "brawl", name: "殴る" })
      expect(acted.results[0].damage).toBeGreaterThanOrEqual(1)
      eventsOrThrow(game.send({ type: "foe-turn" }))
    }
    expect(
      game.state.members.find((member) => member.id === alda)?.used
    ).toEqual(spent)
  })

  it("[feature:W004] 防御を何度送っても、防御している者は重ならない", () => {
    // 敵を行動順に入れないので、防御は解かれずに積まれる
    const game = battle({ order: ["alda", "mort"] })
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    eventsOrThrow(game.send({ type: "act", command: "guard" }))
    const guarding = game.queries.battle(game.state)!.guarding
    expect([...guarding].toSorted()).toEqual([alda, mort].toSorted())
  })

  it("[feature:W004] 助ける仲間を選べ、選ばなければ一番弱っている仲間を助ける", () => {
    const game = battle({
      order: ["mort", "foe-1"],
      patch: (builder) =>
        builder
          .withBag([{ good: contentId("potion"), count: 2 }])
          .withMember("alda", { hp: 100 })
          .withMember("hero", { hp: 20 }),
    })
    const chosen = actedOf(
      eventsOrThrow(
        game.send({
          type: "act",
          command: "item",
          good: contentId("potion"),
          target: alda,
        })
      )
    )
    expect(chosen.results[0].target.id).toBe(alda)
    eventsOrThrow(game.send({ type: "foe-turn" }))
    const auto = actedOf(
      eventsOrThrow(
        game.send({ type: "act", command: "item", good: contentId("potion") })
      )
    )
    expect(auto.results[0].target.id).toBe(hero)
  })
})

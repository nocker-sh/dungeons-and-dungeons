import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { startedState } from "@/lib/wiz/testing/started-state"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"

describe("全滅と踏破", () => {
  it("[feature:W027] 全滅で失った物は街で結果に出て、閉じると消える", () => {
    const { definition } = createTestPlay()
    const base = startedState(definition)
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      {
        ...base,
        gold: 100,
        bag: [{ good: contentId("potion"), count: 2 }],
        wipe: null,
        phase: {
          type: "expedition",
          expedition: {
            layer: contentId("layer0"),
            at: "s",
            visited: ["s"],
            events: [],
            pending: null,
            loot: {
              gold: 40,
              goods: [{ good: contentId("potion"), count: 1 }],
            },
            cleared: false,
          },
        },
      }
    )
    // 全員 HP1 で殴られて全滅する
    const weak = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.99,
        now: () => 0,
        nextId: () => "z",
      }),
      {
        ...game.state,
        members: game.state.members.map((member) => ({
          ...member,
          hp: 1,
          exp: 50,
        })),
      }
    )
    // n1 は必ず戦闘の地点
    eventsOrThrow(weak.send({ type: "advance", to: "n1" }))
    fightToEnd(weak, "guard")
    expect(weak.state.phase.type).toBe("town")
    // 探索で得た分を失い、経験値は残る
    expect(weak.state.gold).toBe(60)
    expect(weak.state.bag).toEqual([{ good: contentId("potion"), count: 1 }])
    expect(
      weak.queries.party(weak.state).every((member) => member.exp >= 50)
    ).toBe(true)
    expect(
      weak.queries.party(weak.state).every((member) => member.hp === 1)
    ).toBe(true)
    const result = weak.queries.result(weak.state)
    expect(result?.kind).toBe("wipe")
    expect(result?.gold).toBe(40)
    expect(result?.goods).toEqual([
      { good: contentId("potion"), name: "回復薬", count: 1 },
    ])
    eventsOrThrow(weak.send({ type: "dismiss-wipe" }))
    expect(weak.state.wipe).toBeNull()
    expect(weak.queries.result(weak.state)).toBeNull()
    expect((weak.send({ type: "dismiss-wipe" }) as GameCommandError).code).toBe(
      "NOT_READY"
    )
  })

  it("[feature:W028] 最後の層のボスを倒すと踏破になり、その後も遊べる", () => {
    // 一撃で決めるために武器の攻撃力だけをそろえる（踏破の規則を測るため）
    const last = realContent().layers[realContent().layers.length - 1]
    const bossHealth = realContent().foes.find(
      (foe) => foe.id === last.boss
    )!.hp
    const definition = new GameDefinition(
      aContent()
        .withWeaponPower(bossHealth * 3)
        .build()
    )
    const boss = last.stations.find((station) => station.boss)!
    const beforeBoss = last.stations.find((station) =>
      station.next.includes(boss.id)
    )!
    const base = startedState(definition)
    const game = definition.create(
      WizWorldEnvironment.create({
        random: () => 0.5,
        now: () => 0,
        nextId: () => "x",
      }),
      {
        ...base,
        reached: realContent().layers.length - 1,
        phase: {
          type: "expedition",
          expedition: {
            layer: last.id,
            at: beforeBoss.id,
            visited: ["s"],
            events: [],
            pending: null,
            loot: { gold: 0, goods: [] },
            cleared: false,
          },
        },
      }
    )
    eventsOrThrow(game.send({ type: "advance", to: boss.id }))
    const events = fightToEnd(game)
    expect(events).toContainEqual({ type: "game-cleared", layer: last.id })
    expect(events).toContainEqual({
      type: "layer-cleared",
      layer: last.id,
      opened: null,
    })
    expect(game.state.cleared).toBe(true)
    eventsOrThrow(game.send({ type: "acknowledge" }))
    eventsOrThrow(game.send({ type: "retreat" }))
    expect(game.queries.result(game.state)?.kind).toBe("ending")
    eventsOrThrow(game.send({ type: "see-ending" }))
    expect(game.state.endingSeen).toBe(true)
    expect(game.queries.result(game.state)).toBeNull()
    expect((game.send({ type: "see-ending" }) as GameCommandError).code).toBe(
      "NOT_READY"
    )
    // 踏破後も出撃できる
    eventsOrThrow(game.send({ type: "depart", layer: last.id }))
  })
})

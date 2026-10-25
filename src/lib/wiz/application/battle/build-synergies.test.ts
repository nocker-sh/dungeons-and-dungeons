import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
  skillBySlug,
} from "@/lib/wiz/testing"

describe("3人の連携を支える技", () => {
  it("毒を仕込んだ敵への追撃が強くなり、毒のない敵への威力は増えない", () => {
    const content = aContent()
      .withFoe("kamokutsu", { hp: 1000, atk: 0 })
      .build()
    const state = aState()
      .withExtraMember("jig")
      .withParty(["hero", "jig", "mort"])
      .inBattle({
        foes: ["kamokutsu"],
        order: ["jig", "foe-1", "hero", "mort"],
      })
      .build()
    if (state.phase.type !== "battle") throw new Error("fixture")
    const ordinary = createTestGame({ content, state, random: 0.5 })
    const poisoned = createTestGame({
      content,
      state: {
        ...state,
        phase: {
          ...state.phase,
          battle: {
            ...state.phase.battle,
            foes: state.phase.battle.foes.map((foe) => ({
              ...foe,
              status: [{ kind: "poison", turns: 3 }],
            })),
          },
        },
      },
      random: 0.5,
    })
    const action = {
      type: "act",
      command: "skill",
      skill: contentId("poison-finish"),
      target: "foe-1",
    } as const
    const damage = (events: ReturnType<typeof eventsOrThrow>) =>
      events
        .flatMap((event) => (event.type === "acted" ? event.results : []))
        .find((result) => result.target.id === "foe-1")!.damage!
    expect(damage(eventsOrThrow(poisoned.send(action)))).toBeGreaterThan(
      damage(eventsOrThrow(ordinary.send(action))) * 1.6
    )
  })

  it("HP代償を払う魔弾は実際に与えたHP被害だけ吸収し、一つの行動で見せる", () => {
    const content = aContent()
      .withFoe("kamokutsu", { hp: 1000, atk: 0 })
      .build()
    const game = createTestGame({
      content,
      // 魔弾はマユのワザなので、アルダと入れ替えて先に動かす
      state: aState()
        .withJoined("mayu", { replacing: "alda" })
        .withMember("mayu", { hp: 60 })
        .inBattle({
          foes: ["kamokutsu"],
          order: ["mayu", "foe-1", "hero", "mort"],
        })
        .build(),
      random: 0.5,
    })
    const before = game.state.members.find(
      (member) => member.id === contentId("mayu")
    )!.hp
    const events = eventsOrThrow(
      game.send({
        type: "act",
        command: "skill",
        skill: contentId("leech-shot"),
        target: "foe-1",
      })
    )
    const acted = events.find((event) => event.type === "acted")!
    expect(acted.type).toBe("acted")
    if (acted.type !== "acted") throw new Error("fixture")
    const hit = acted.results.find((result) => result.target.kind === "foe")!
    const heal = acted.results.find(
      (result) => result.target.id === contentId("mayu")
    )!
    expect(heal.heal).toBe(Math.floor(hit.damage! * 0.65))
    expect(
      game.state.members.find((member) => member.id === contentId("mayu"))!.hp
    ).toBe(before - acted.paid! + heal.heal!)
    expect(events.filter((event) => event.type === "acted")).toHaveLength(1)
  })

  it("吸収は過剰なとどめや最大HP超過から回復を稼げない", () => {
    const game = createTestGame({
      state: aState()
        .withExtraMember("husky", { hp: 1 })
        .withParty(["hero", "husky", "mort"])
        .inBattle({
          foes: ["kamokutsu"],
          order: ["husky", "foe-1", "hero", "mort"],
        })
        .build(),
      random: 0.5,
    })
    const save = game.save()
    if (save.snapshot.phase.type !== "battle") throw new Error("fixture")
    const low = {
      ...save,
      snapshot: {
        ...save.snapshot,
        phase: {
          ...save.snapshot.phase,
          battle: {
            ...save.snapshot.phase.battle,
            foes: save.snapshot.phase.battle.foes.map((foe) => ({
              ...foe,
              hp: 2,
            })),
          },
        },
      },
    }
    expect(game.restore(low)).toBeUndefined()
    eventsOrThrow(
      game.send({
        type: "act",
        command: "skill",
        skill: contentId("blood-punch"),
        target: "foe-1",
      })
    )
    expect(
      game.state.members.find((member) => member.id === contentId("husky"))!.hp
    ).toBe(1 + Math.floor(2 * skillBySlug("blood-punch").drain!))
  })

  it("支援役が仲間へ攻勢の合図を渡し、仲間の次の攻撃で消費する", () => {
    const content = aContent()
      .withFoe("kamokutsu", { hp: 1000, atk: 0 })
      .build()
    const state = aState()
      .withExtraMember("gou")
      .withJoined("mayu")
      .withParty(["hero", "gou", "mayu"])
      .inBattle({
        foes: ["kamokutsu"],
        order: ["gou", "mayu", "foe-1", "hero"],
      })
      .build()
    const game = createTestGame({ content, state, random: 0.5 })
    eventsOrThrow(
      game.send({
        type: "act",
        command: "skill",
        skill: contentId("rally-ally"),
        target: contentId("mayu"),
      })
    )
    expect(
      game.state.members.find((member) => member.id === contentId("mayu"))!
        .status
    ).toContainEqual({ kind: "charge", turns: 3 })
    eventsOrThrow(
      game.send({
        type: "act",
        command: "skill",
        skill: contentId("curse-mark"),
        target: "foe-1",
      })
    )
    expect(
      game.state.members
        .find((member) => member.id === contentId("mayu"))!
        .status.some((status) => status.kind === "charge")
    ).toBe(false)
  })

  it.each([
    ["tsumugi", "plant-revival"],
    ["alma", "hero-rescue"],
  ] as const)("シオンがいない編成でも%sが蘇生できる", (member, skill) => {
    const game = createTestGame({
      state: aState()
        .withExtraMember(member)
        .withParty(["hero", "alda", member])
        .withMember("alda", { hp: 0 })
        .inBattle({
          foes: ["kamokutsu"],
          order: [member, "foe-1", "hero", "alda"],
        })
        .build(),
      random: 0.5,
    })
    eventsOrThrow(
      game.send({
        type: "act",
        command: "skill",
        skill: contentId(skill),
        target: contentId("alda"),
      })
    )
    expect(
      game.state.members.find((entry) => entry.id === contentId("alda"))!.hp
    ).toBeGreaterThan(0)
  })
})

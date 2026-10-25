import { describe, expect, it } from "vite-plus/test"
import { BattleRules, GameCatalog, PartyRules } from "@/lib/wiz"
import { Statuses } from "@/lib/wiz/rules/statuses"
import {
  aContent,
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
} from "@/lib/wiz/testing"

describe("挑発で仲間を守る", () => {
  it("後衛の挑発者にも敵の単体攻撃が向き、倒れていれば狙わない", () => {
    const catalog = new GameCatalog(aContent().build())
    const rules = new BattleRules(catalog, new PartyRules(catalog))
    const state = aState().build()
    const members = state.party.map((id) =>
      state.members.find((member) => member.id === id)!
    )
    const taunters = members.map((member, index) => ({
      ...member,
      status: index === 2 ? Statuses.add([], "taunt", 2) : [],
    }))
    for (const roll of [0, 0.2, 0.8, 0.999]) {
      // 近接でも、後衛の挑発者には届く
      expect(rules.target(taunters, () => roll, "melee")?.id).toBe(
        members[2].id
      )
      expect(
        rules.target(
          taunters.map((member, index) => ({
            ...member,
            hp: index === 2 ? 0 : member.hp,
          })),
          () => roll
        )?.id
      ).not.toBe(members[2].id)
    }
  })

  it("複数の挑発者には分散し、控えの仲間は含めない", () => {
    const catalog = new GameCatalog(aContent().build())
    const rules = new BattleRules(catalog, new PartyRules(catalog))
    const state = aState().build()
    const members = state.party.slice(0, 2).map((id) => ({
      ...state.members.find((member) => member.id === id)!,
      status: Statuses.add([], "taunt", 2),
    }))
    expect(rules.target(members, () => 0)?.id).toBe(members[0].id)
    expect(rules.target(members, () => 0.999)?.id).toBe(members[1].id)
  })

  it("単体攻撃を引き受けて25％減らし、挑発は攻撃一回で消えない", () => {
    const content = aContent()
      .withFoe("hiyokobu", { atk: 100, skills: [], skillRate: 0 })
      .build()
    const game = createTestGame({
      content,
      random: 0.5,
      state: aState()
        .withExtraMember("gald")
        .withParty(["hero", "alda", "gald"])
        .withMember("gald", { status: [{ kind: "taunt", turns: 2 }] })
        .inBattle({
          foes: ["hiyokobu"],
          order: ["foe-1", "hero", "alda", "gald"],
        })
        .build(),
    })
    const events = eventsOrThrow(game.send({ type: "foe-turn" }))
    const acted = events.find((event) => event.type === "acted")
    if (acted?.type !== "acted") throw new Error("acted がない")
    expect(acted.results).toHaveLength(1)
    expect(acted.results[0].target.id).toBe(contentId("gald"))
    expect(acted.results[0].damage).toBe(75)
    expect(
      game.state.members.find((member) => member.id === contentId("gald"))!
        .status
    ).toContainEqual({ kind: "taunt", turns: 2 })
  })

  it("全体攻撃は挑発で消せず、守りと挑発の軽減は乗算しない（近接の全体攻撃は前衛だけ）", () => {
    const content = aContent()
      .withSkill("ground-roar", { power: 1 })
      .withFoe("hiyokobu", {
        atk: 100,
        skills: [contentId("ground-roar")],
        skillRate: 1,
      })
      .build()
    const game = createTestGame({
      content,
      random: 0.5,
      state: aState()
        .withMember("alda", {
          status: [
            { kind: "taunt", turns: 2 },
            { kind: "protect", turns: 1 },
          ],
        })
        .inBattle({
          foes: ["hiyokobu"],
          order: ["foe-1", "hero", "alda", "mort"],
        })
        .build(),
    })
    const acted = eventsOrThrow(game.send({ type: "foe-turn" })).find(
      (event) => event.type === "acted"
    )
    if (acted?.type !== "acted") throw new Error("acted がない")
    // 地鳴らしは近接なので、後衛のモートには届かない
    expect(acted.results.map((hit) => hit.target.id)).toEqual([
      contentId("hero"),
      contentId("alda"),
    ])
    expect(
      acted.results.find((hit) => hit.target.id === contentId("alda"))?.damage
    ).toBe(50)
    const statuses = game.state.members.find(
      (member) => member.id === contentId("alda")
    )!.status
    expect(Statuses.has(statuses, "protect")).toBe(false)
    expect(Statuses.has(statuses, "taunt")).toBe(true)
  })

  it("挑発は自分の手番で期限が減り、永続しない", () => {
    expect(Statuses.tick(Statuses.add([], "taunt", 1))).toEqual([])
  })
})

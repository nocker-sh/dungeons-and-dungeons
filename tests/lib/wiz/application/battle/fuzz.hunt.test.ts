import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { seededRandom } from "@/lib/wiz/testing/seeded-random"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { Game } from "@/lib/wiz/game/game"
import type { GameAction } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"

describe("戦闘にでたらめな指示を送る（hunt）", () => {
  const content = aContent().build()
  const catalog = new GameCatalog(content)
  const party = new PartyRules(catalog)
  const skillIds = [...content.skills.map((skill) => skill.id), "no-such-skill"]
  const goodIds = [...content.goods.map((good) => good.id), "no-such-good"]
  const targetIds = [
    "alda",
    "mayu",
    "hero",
    "mort",
    "foe-1",
    "foe-2",
    "no-such-target",
    undefined,
  ]

  /** 一つの指示をでたらめに組み立てる（形は正しく、中身は当たり外れ）。 */
  function randomAction(random: () => number): GameAction {
    const pick = <T>(list: readonly T[]) =>
      list[Math.min(list.length - 1, Math.floor(random() * list.length))]
    const roll = random()
    if (roll < 0.2) return { type: "foe-turn" }
    if (roll < 0.3) return { type: "act", command: "guard" }
    if (roll < 0.4) return { type: "act", command: "brawl" }
    if (roll < 0.6)
      return {
        type: "act",
        command: "item",
        good: pick(goodIds),
        target: pick(targetIds),
      }
    return {
      type: "act",
      command: "skill",
      skill: pick(skillIds),
      target: pick(targetIds),
    }
  }

  /** 状態の枠。どの指示のあとでも保たれていなければならない。 */
  function checkInvariants(game: Game, note: string) {
    const state: GameState = game.state
    expect(state.gold, note).toBeGreaterThanOrEqual(0)
    for (const member of state.members) {
      const stats = party.stats(member, state)
      expect(member.hp, `${note} ${member.id} のHP`).toBeGreaterThanOrEqual(0)
      expect(member.hp, `${note} ${member.id} のHP`).toBeLessThanOrEqual(
        stats.maxHp
      )
      for (const entry of member.used) {
        const max = party.skills.maxUses(member, state, entry.skill)
        expect(
          entry.count,
          `${note} ${member.id}/${entry.skill}`
        ).toBeGreaterThan(0)
        if (max !== null)
          expect(
            entry.count,
            `${note} ${member.id}/${entry.skill}`
          ).toBeLessThanOrEqual(max)
      }
      for (const entry of member.status)
        expect(entry.turns, `${note} ${member.id} の状態`).toBeGreaterThan(0)
    }
    for (const gear of state.gear) {
      expect(gear.wear, `${note} ${gear.id}`).toBeGreaterThanOrEqual(0)
      expect(gear.wear, `${note} ${gear.id}`).toBeLessThanOrEqual(
        party.equipment.maxDurabilityOf(
          catalog.good(gear.good) ?? {},
          gear.plus
        )
      )
    }
    for (const entry of state.bag)
      expect(entry.count, `${note} ${entry.good}`).toBeGreaterThan(0)
    if (state.phase.type !== "battle") return
    const { battle } = state.phase
    for (const foe of battle.foes) {
      expect(foe.hp, `${note} ${foe.id}`).toBeGreaterThanOrEqual(0)
      expect(foe.hp, `${note} ${foe.id}`).toBeLessThanOrEqual(foe.maxHp)
    }
    // 手番は必ず動ける者に回る（倒れている者で止まると誰も指示を出せなくなる）
    const current = battle.order[battle.turn % battle.order.length]
    const hp =
      current.kind === "member"
        ? (state.members.find((member) => member.id === current.id)?.hp ?? 0)
        : (battle.foes.find((foe) => foe.id === current.id)?.hp ?? 0)
    expect(hp, `${note} 手番の ${current.id} が倒れている`).toBeGreaterThan(0)
  }

  it("[feature:W004] どの指示を送っても壊れず、手番は動ける者に回る", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const random = seededRandom(seed)
      const state = aState(content)
        .withBag([
          { good: contentId("potion"), count: 2 },
          { good: contentId("revive"), count: 1 },
          { good: contentId("ether"), count: 1 },
          { good: contentId("bomb"), count: 1 },
          { good: contentId("smoke"), count: 1 },
          { good: contentId("antidote"), count: 1 },
          { good: contentId("elixir"), count: 1 },
          { good: contentId("junk"), count: 1 },
        ])
        .inBattle({
          foes: ["kamokutsu", "koburakuda"],
          order: ["alda", "foe-1", "hero", "foe-2", "mort"],
        })
        .build()
      const game = createTestGame({ content, state, random })
      for (let step = 0; step < 60; step++) {
        if (game.state.phase.type !== "battle") break
        const action = randomAction(random)
        const note = `seed ${seed} step ${step} ${JSON.stringify(action)}`
        const result = game.send(action)
        if (result instanceof GameCommandError)
          expect(result.code, note).not.toBe("ENGINE_FAILURE")
        checkInvariants(game, note)
      }
    }
    // 種ごとに60手ずつ送るので、混み合っても落ちないよう長めに待つ
  }, 30000)
})

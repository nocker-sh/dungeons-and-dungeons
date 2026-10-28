import { expect, it } from "vite-plus/test"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import type { Game } from "@/lib/wiz/game/game"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"

/** HP補正のある強化済み・消耗済み防具で、移譲時の両者のHPも検証する。 */
function armoredGame() {
  const leather = goodBySlug("leather")
  const source = realContent()
  const content = {
    ...source,
    goods: source.goods.map((good) =>
      good.id === leather.id ? { ...good, bonus: { maxHp: 20 } } : good
    ),
  }
  const game = createTestGame({ content })
  const owner = contentId("alda")
  const state = {
    ...game.state,
    gear: [
      ...game.state.gear.filter(
        (gear) =>
          gear.owner !== owner ||
          content.goods.find((good) => good.id === gear.good)?.kind !== "armor"
      ),
      {
        id: "comparison-armor",
        good: leather.id,
        owner,
        plus: 2,
        wear: 7,
        progress: 0,
        weapon: null,
      },
    ],
  }
  const equipped = createTestGame({ content: content, state })
  return createTestGame({
    content: content,
    state: {
      ...state,
      members: state.members.map((member) => ({
        ...member,
        hp: equipped.queries.member(state, member.id)!.maxHp,
      })),
    },
  })
}

function displayedStats(game: Game, memberId: string) {
  const member = game.queries.member(game.state, memberId)!
  return {
    hp: member.hp,
    maxHp: member.maxHp,
    str: member.str,
    tec: member.tec,
    spd: member.spd,
    attack: member.weapon?.attack ?? 1,
    durability: member.armor?.durability ?? 0,
    maxDurability: member.armor?.maxDurability ?? 0,
  }
}

it("防具移譲の比較は両者の実際の装備結果と一致し、保存を変えない", () => {
  const game = armoredGame()
  const receiver = contentId("mort")
  const owner = contentId("alda")
  const save = game.save()
  const comparison = game.queries.armorComparison(
    game.state,
    receiver,
    "comparison-armor"
  )!
  expect(comparison).not.toBeNull()
  expect(comparison.before).toEqual(displayedStats(game, receiver))
  expect(comparison.previousOwner!.before).toEqual(displayedStats(game, owner))
  expect(game.save()).toEqual(save)

  inPhase(game, "town")!.equip("comparison-armor", receiver)
  expect(comparison.after).toEqual(displayedStats(game, receiver))
  expect(comparison.previousOwner!.after).toEqual(displayedStats(game, owner))
  expect(comparison.previousOwner!.after.hp).toBeLessThan(
    comparison.previousOwner!.before.hp
  )
})

it("防具取り外しの比較は実際の能力・HPと一致し、保存を変えない", () => {
  const game = armoredGame()
  const owner = contentId("alda")
  const save = game.save()
  const comparison = game.queries.armorRemovalComparison(
    game.state,
    "comparison-armor"
  )!
  expect(comparison).not.toBeNull()
  expect(comparison.before).toEqual(displayedStats(game, owner))
  expect(game.save()).toEqual(save)

  inPhase(game, "town")!.unequip("comparison-armor")
  expect(comparison.after).toEqual(displayedStats(game, owner))
  expect(comparison.after.hp).toBeLessThan(comparison.before.hp)
  expect(
    game.queries.armorRemovalComparison(game.state, "comparison-armor")
  ).toBeNull()
})

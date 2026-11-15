import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import type { Game } from "@/lib/wiz/game/game"

/** 悪魔の最初の攻撃のワザ（呼んだときの必殺技）。作品データから引く。 */
function callOf(demonId: string) {
  const content = realContent()
  const demon = content.demons.find((entry) => entry.id === demonId)!
  const skill = demon.skills
    .map((id) => content.skills.find((entry) => entry.id === id))
    .find((entry) => entry?.kind === "hit")
  return skill
    ? { id: skill.id, name: skill.name, power: skill.power ?? 1 }
    : null
}

/** 出撃の仲間ごとのHP・攻撃力。悪魔を選んでも変わらないことを比べる。 */
function partyStats(game: Game) {
  return game.state.party.map((id) => {
    const member = game.queries.member(game.state, id)!
    return {
      id,
      hp: member.hp,
      maxHp: member.maxHp,
      attack: member.weapon!.attack,
    }
  })
}

describe.each([null, "lox", "nui"])(
  "[feature:W013] 戦闘で呼ぶ悪魔の候補（現在=%s）",
  (contract) => {
    it.each(["full", "hurt", "fallen"])(
      "%s の仲間がいても、候補は必殺技を示し、選んでも仲間の強さは変わらず、閲覧では保存を変えない",
      (condition) => {
        const mayu = contentId("mayu")
        const base = createTestGame({
          state: aState()
            .withDemons(
              [
                { id: "lox", lv: 10, exp: 0 },
                { id: "nui", lv: 1, exp: 0 },
              ],
              contract
            )
            .withMember("mayu", {
              used: [{ skill: contentId("magicbullet"), count: 1 }],
            })
            .build(),
        })
        const hp =
          condition === "full"
            ? base.queries.member(base.state, mayu)!.maxHp
            : condition === "hurt"
              ? 7
              : 0
        const game = createTestGame({
          state: {
            ...base.state,
            members: base.state.members.map((member) =>
              member.id === mayu ? { ...member, hp } : member
            ),
          },
        })
        const before = game.save()
        const state = game.state
        const stats = partyStats(game)
        const options = game.queries.demons(state)
        expect(game.state).toBe(state)
        expect(game.save()).toEqual(before)
        expect(options.map((option) => option.id)).toEqual([
          contentId("lox"),
          contentId("nui"),
        ])
        for (const option of options) {
          // 合体の比較・相性は廃止し、呼んだときの必殺技を出す
          expect(option).not.toHaveProperty("comparison")
          expect(option).not.toHaveProperty("affinity")
          expect(option.call).toEqual(callOf(option.id))
          expect(option.call).not.toBeNull()
          expect(option.active).toBe(option.id === state.contract)
          const chosen = createTestGame({ state })
          eventsOrThrow(chosen.send({ type: "choose-demon", demon: option.id }))
          expect(chosen.state.contract).toBe(option.id)
          expect(partyStats(chosen)).toEqual(stats)
          expect(chosen.state.gold).toBe(state.gold)
          expect(chosen.state.members.map((member) => member.used)).toEqual(
            state.members.map((member) => member.used)
          )
          const saved = chosen.save()
          expect(chosen.restore(saved)).toBeUndefined()
          expect(chosen.save()).toEqual(saved)
        }
      }
    )
  }
)

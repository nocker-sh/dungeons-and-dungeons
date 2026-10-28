import { describe, expect, it } from "vite-plus/test"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"

describe.each([null, "lox", "nui"])("合体の比較（現在=%s）", (contract) => {
  it.each(["full", "hurt", "fallen"])(
    "%s のHPと攻撃力を実際の合体どおり予測し、閲覧では保存を変えない",
    (condition) => {
      const base = createTestGame({
        state: aState()
          .withDemons(
            [
              { id: "lox", lv: 10, exp: 0 },
              { id: "nui", lv: 1, exp: 0 },
            ],
            contract
          )
          .withMember("hero", {
            used: [
              {
                skill: realContent().demons.find(
                  (demon) => demon.id === contentId("lox")
                )!.skills[0],
                count: 1,
              },
            ],
          })
          .build(),
      })
      const hero = contentId("hero")
      const hp =
        condition === "full"
          ? base.queries.member(base.state, hero)!.maxHp
          : condition === "hurt"
            ? 7
            : 0
      const game = createTestGame({
        state: {
          ...base.state,
          members: base.state.members.map((member) =>
            member.id === hero ? { ...member, hp } : member
          ),
        },
      })
      const before = game.save()
      const state = game.state
      const current = game.queries.member(state, hero)!
      const options = game.queries.demons(state)
      expect(game.state).toBe(state)
      expect(game.save()).toEqual(before)
      for (const option of options) {
        expect(option.comparison?.before).toEqual({
          hp: current.hp,
          maxHp: current.maxHp,
          attack: current.weapon!.attack,
        })
        const chosen = createTestGame({ state })
        eventsOrThrow(chosen.send({ type: "choose-demon", demon: option.id }))
        const after = chosen.queries.member(chosen.state, hero)!
        expect(option.comparison?.after).toEqual({
          hp: after.hp,
          maxHp: after.maxHp,
          attack: after.weapon!.attack,
        })
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
})

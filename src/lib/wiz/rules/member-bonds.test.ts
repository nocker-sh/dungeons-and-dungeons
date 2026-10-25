import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz"
import {
  contentId,
  eventsOrThrow,
  realContent,
  startedState,
  testEnvironment,
} from "@/lib/wiz/testing"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { MemberBonds } from "@/lib/wiz/rules/member-bonds"

const definition = new GameDefinition(realContent())
const hero = contentId("hero")
const likes = (state: ReturnType<typeof startedState>) =>
  Object.fromEntries(state.members.map((member) => [member.id, member.like]))

describe("仲間との親しさ", () => {
  it("一緒に出撃すると、主人公以外の2人の親しさが1上がる", () => {
    const start = startedState(definition)
    const game = definition.create(testEnvironment({ random: 0 }), start)
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const after = likes(game.state)
    for (const member of start.members) {
      const expected =
        start.party.includes(member.id) && member.id !== hero ? 1 : 0
      expect(after[member.id]).toBe(member.like + expected)
    }
  })

  it("宿に泊まると、出撃の3人（主人公を除く）の親しさが1上がる", () => {
    const start = startedState(definition)
    const game = definition.create(testEnvironment({ random: 0 }), {
      ...start,
      gold: 100,
    })
    eventsOrThrow(game.send({ type: "rest", room: contentId("attic") }))
    const after = likes(game.state)
    for (const member of start.members) {
      const expected =
        start.party.includes(member.id) && member.id !== hero ? 1 : 0
      expect(after[member.id]).toBe(member.like + expected)
    }
  })

  it("段ごとの呼び名と、親しさで開く会話", () => {
    const bonds = new MemberBonds()
    const rules = new ConversationRules(definition.catalog)
    const alda = contentId("alda")
    const script = definition.catalog.data.conversations!.find(
      (entry) => entry.id === "alda-bond-1"
    )!
    const at = (like: number) => {
      const state = startedState(definition)
      return {
        ...state,
        nights: 1,
        members: state.members.map((member) =>
          member.id === alda ? { ...member, like } : member
        ),
      }
    }
    expect(bonds.view(at(0), alda).label).toBe("仕事仲間")
    expect(bonds.view(at(4), alda).label).toBe("話せる仲")
    expect(bonds.view(at(10), alda).label).toBe("気の置けない仲")
    expect(bonds.view(at(18), alda).label).toBe("大切な仲間")
    expect(rules.reasons(at(3), "inn", script)).toContain(
      "まだ親しくなっていない"
    )
    expect(rules.reasons(at(4), "inn", script)).toEqual([])
  })
})

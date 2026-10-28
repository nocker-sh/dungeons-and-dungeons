import { describe, expect, it } from "vite-plus/test"
import {
  resolvePortrait,
  type BustPortraitSlots,
} from "@/concept/portrait-types"
import { conversationSchema } from "@/lib/wiz/conversations/schema"
import { characterGroups } from "@/concept/characters"
import { portraitOf } from "@/content/looks/portrait-of"

const bust: BustPortraitSlots = {
  normal: "bust-normal",
  talk: "bust-talk",
  happy: "bust-happy",
  sigh: "bust-sigh",
  angry: "bust-angry",
  surprised: "bust-surprised",
  surprisedLarge: "bust-surprised-large",
  thinking: "bust-thinking",
  shy: "bust-shy",
  special: "bust-special",
}

describe("会話の追加表情", () => {
  it("会話の驚きと明示した驚き（大）がそれぞれ別の上半身を使う", () => {
    const characters = characterGroups
      .flatMap((group) => group.characters)
      .filter(
        (character) =>
          (character.bustPortraits ?? character.portraits)?.surprisedLarge
      )
    expect(characters.length).toBeGreaterThan(0)
    for (const character of characters) {
      const portrait = (character.bustPortraits ?? character.portraits)!
      expect(portrait.surprised).toBeTruthy()
      expect(portrait.surprised).not.toBe(portrait.surprisedLarge)
      for (const expression of ["surprised", "surprisedLarge"] as const) {
        const conversation = conversationSchema.parse({
          id: "surprise-strength-test",
          title: "驚きの強さ",
          trigger: "talk",
          participants: [character.id],
          lines: [{ speaker: character.id, text: "そうなんだ", expression }],
        })
        expect(conversation.lines[0].expression).toBe(expression)
        expect(portraitOf(character.id, expression)).toBe(portrait[expression])
      }
    }
  })
  it("表情指定を台本から受け取り、対応する上半身へ切り替える", () => {
    for (const expression of [
      "surprised",
      "surprisedLarge",
      "thinking",
      "shy",
      "special",
    ] as const) {
      const conversation = conversationSchema.parse({
        id: "expression-test",
        title: "表情",
        trigger: "talk",
        participants: ["person"],
        lines: [{ speaker: "person", text: "一言", expression }],
      })
      expect(
        resolvePortrait(
          { normal: "full-body" },
          conversation.lines[0].expression,
          bust
        )
      ).toBe(bust[expression])
    }
  })

  it("通常も上半身を使い、画像がない表情は上半身の通常へ戻す", () => {
    expect(resolvePortrait({ normal: "full-body" }, "normal", bust)).toBe(
      "bust-normal"
    )
    const { shy: _shy, ...oldBust } = bust
    expect(resolvePortrait({ normal: "full-body" }, "shy", oldBust)).toBe(
      "bust-normal"
    )
    expect(
      resolvePortrait({ normal: "full-body", skill: "skill" }, "skill", bust)
    ).toBe("skill")
  })

  it("通常の上半身とは別に登録した特殊モーションを選べる", () => {
    const { special: _special, ...ordinaryBust } = bust
    expect(
      resolvePortrait(
        { normal: "normal", special: "show-notice" },
        "special",
        ordinaryBust
      )
    ).toBe("show-notice")
    expect(resolvePortrait({ normal: "normal" }, "special", ordinaryBust)).toBe(
      "bust-normal"
    )
  })
})

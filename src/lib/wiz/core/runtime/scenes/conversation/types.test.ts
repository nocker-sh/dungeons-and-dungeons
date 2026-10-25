import { describe, expect, it } from "vite-plus/test"
import {
  toWizSceneConversationContentLine,
  toWizSceneConversationSpeaker,
} from "@/lib/wiz/core/runtime/scenes/conversation/types"

describe("toWizSceneConversationSpeaker", () => {
  it("canonical player and narrator rolesをtokenとして保持する", () => {
    expect(toWizSceneConversationSpeaker("player")).toBe("player")
    expect(toWizSceneConversationSpeaker("Narrator")).toBe("narrator")
  })

  it("NPC名や未指定speakerをnpc roleへ正規化する", () => {
    expect(toWizSceneConversationSpeaker("Elda")).toBe("npc")
    expect(toWizSceneConversationSpeaker(undefined)).toBe("npc")
  })
})

describe("toWizSceneConversationContentLine", () => {
  it("role tokenとcontent側のspeaker keyを両方保持する", () => {
    expect(
      toWizSceneConversationContentLine({
        speaker: "party_member_2",
        text: "Ready.",
        emotion: "calm",
      }),
    ).toEqual({
      type: "content",
      speaker: "npc",
      sourceSpeaker: "party_member_2",
      text: "Ready.",
      emotion: "calm",
      portrait: undefined,
    })
  })
})

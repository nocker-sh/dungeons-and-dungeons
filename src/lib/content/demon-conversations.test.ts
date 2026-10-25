import { describe, expect, it } from "vite-plus/test"
import conversations from "@/lib/content/data/conversations.json"
import demons from "@/lib/content/data/demons.json"

/**
 * 悪魔はプレイヤーとしか話さない（2026-10-12 ユーザー指示）。
 * 決める前からある台本で、悪魔が仲間・住人・ほかの悪魔と同じ場面に出るもの。直すまでここに残し、増やさない。
 */
const existingMixedScenes = new Set([
  "rize-lox-inn",
  "nui-tsumugi-inn",
  "yoru-haro-inn",
  "yoru-talk-09",
  "zaza-encounter",
  "nui-zaza-friends-1",
  "nui-zaza-friends-2",
  "nui-zaza-friends-3",
  "nui-zaza-friends-4",
])

describe("悪魔の会話", () => {
  it("悪魔が出る場面は、その悪魔とプレイヤーだけ（話者は悪魔ひとり）", () => {
    const demonIds = new Set(demons.map((demon) => demon.id))
    const mixed = conversations
      .filter(
        (script) =>
          script.participants.some((person) => demonIds.has(person)) &&
          script.participants.length > 1
      )
      .map((script) => script.id)
    expect(mixed.filter((id) => !existingMixedScenes.has(id))).toEqual([])
    // 直した台本は一覧からも外す
    expect(
      [...existingMixedScenes].filter((id) => !mixed.includes(id))
    ).toEqual([])
  })
})

import { describe, expect, it } from "vite-plus/test"
import { look } from "./lib/look"
import { Session } from "./lib/session"

describe("AI が遊ぶための look", () => {
  it("店の品ぞろえに、値段・買えるか・持つと強くなる仲間を出す", () => {
    // はじめから3人（主人公・アルダ・モート）がそろっている
    const session = Session.create()
    expect(session.state.party.map((id) => session.slug(id))).toContain("alda")
    const lines = look(session, ["shop", "armory"])
    const greatsword = lines.find((line) => line.includes("greatsword："))
    expect(greatsword).toMatch(/120G/)
    expect(greatsword).toMatch(/アルダが持つと攻撃力 \d+→\d+/)
    expect(lines.every((line) => /^[○×] /.test(line))).toBe(true)
  })

  it("募集・依頼・部屋・敵・ワザを slug つきで出し、知らない話題には話題の一覧を返す", () => {
    const session = Session.create()
    expect(look(session, ["recruits"]).join("\n")).toMatch(/n-alda：アルダ/)
    expect(look(session, ["rooms"]).length).toBeGreaterThan(0)
    expect(look(session, ["foe", "kamokutsu"])[0]).toMatch(
      /^スタンプダック：HP\d+/
    )
    expect(look(session, ["skill", "burrow-claw"])[0]).toMatch(/^掘り爪：/)
    expect(look(session, ["nothing"])[0]).toMatch(/^look の話題：/)
  })
})

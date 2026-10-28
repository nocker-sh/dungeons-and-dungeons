import { describe, expect, it } from "vite-plus/test"
import { look } from "@/builder/lib/look"
import { Session } from "@/builder/lib/session"

describe("AI が遊ぶための look", () => {
  it.each(["weapon", "armor"])(
    "%sを最後の段へ強化すると、次の費用を金額ではなく上限と表示する",
    (kind) => {
      const session = Session.create()
      if (kind === "weapon")
        session.must({
          type: "buy",
          shop: session.id("armory", "shops"),
          good: session.id("sword", "goods"),
        })
      const gear = session.state.gear.find(
        (entry) => session.catalog.good(entry.good)?.kind === kind
      )!
      const steps = session.catalog.data.smithy!.upgrades
      const cost = steps.at(-1)!
      session.patch((state) => {
        state.gear.find((entry) => entry.id === gear.id)!.plus =
          steps.length - 1
        state.gold = cost.gold
        state.bag = cost.materials.map((entry) => ({ ...entry }))
      })
      const line = () =>
        look(session, ["smithy"]).find((line) =>
          line.includes(`強化 ${gear.id}：`)
        )!
      const before = session.dump()
      expect(line()).toMatch(new RegExp(`^○ .* ${cost.gold}G$`))
      expect(session.dump()).toEqual(before)
      session.must({ type: "upgrade", gear: gear.id })
      expect(session.state.gold).toBe(0)
      const upgraded = session.dump()
      expect(line()).toMatch(/^× .* 上限$/)
      expect(line()).not.toMatch(/null|undefined/)
      expect(session.dump()).toEqual(upgraded)
      expect(session.send({ type: "upgrade", gear: gear.id })).toMatchObject({
        code: "MAX",
      })
      expect(session.dump()).toEqual(upgraded)
    }
  )

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

import { describe, expect, it } from "vite-plus/test"
import { battleAction } from "@/../builder/lib/policy"
import { Session } from "@/../builder/lib/session"
import { SeededRandom } from "@/../builder/lib/random"
import { aState, contentId } from "@/lib/wiz/testing"

describe("編成比較の戦闘方策", () => {
  it("前衛が次の攻撃で倒れるとき、使える防具修復で耐えられるなら選ぶ", () => {
    const session = Session.create()
    const state = aState()
      .withExtraMember("rivet")
      .withParty(["alda", "rivet", "hero"])
      // スタンプダックの一撃（攻撃力）には HP だけでは届かず、修復した耐久を足せば耐える
      // 主人公は防具を着けないので、防具を着けた前衛のアルダで確かめる
      .withMember("alda", { hp: 64 })
      .inBattle({
        foes: ["kamokutsu"],
        order: ["rivet", "foe-1", "alda", "hero"],
      })
      .build()
    expect(
      session.game.restore({ ...session.game.save(), snapshot: state })
    ).toBeUndefined()
    session.patch((snapshot) => {
      const coat = snapshot.gear.find(
        (gear) => gear.owner === contentId("alda") && !gear.weapon
      )!
      coat.wear = 20
    })
    const action = battleAction(session, "smart", new SeededRandom(1))
    expect(action).toEqual({
      type: "act",
      command: "skill",
      skill: contentId("earth-mend"),
      target: contentId("alda"),
    })
    session.must(action)
    const alda = session.queries.member(session.state, contentId("alda"))!
    expect(alda.hp).toBe(64)
    expect(alda.armor!.durability).toBe(alda.armor!.maxDurability)
  })

  it("傷んでいない防具へ修復を浪費しない", () => {
    const session = Session.create()
    const state = aState()
      .withExtraMember("rivet")
      .withParty(["alda", "rivet", "hero"])
      .inBattle({
        foes: ["kamokutsu"],
        order: ["rivet", "foe-1", "alda", "hero"],
      })
      .build()
    expect(
      session.game.restore({ ...session.game.save(), snapshot: state })
    ).toBeUndefined()
    expect(
      battleAction(session, "smart", new SeededRandom(1))
    ).not.toMatchObject({ skill: contentId("earth-mend") })
  })
})

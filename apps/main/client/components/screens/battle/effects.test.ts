import { describe, expect, it } from "vite-plus/test"
import { attackEffect, statusEffects } from "./effects"
import assignments from "@/concept/data/battle-effects.json"
import effects from "@/concept/data/effects.json"
import skills from "@/content/data/skills.json"
import { statusKinds } from "@/lib/wiz/content/constants"

describe("戦闘エフェクトの作品データ", () => {
  it("現在の攻撃ワザを重複なく網羅し、存在する画像だけを参照する", () => {
    const assigned = assignments.map((entry) => entry.skill)
    expect(new Set(assigned).size).toBe(assigned.length)
    expect([...assigned].sort()).toEqual(
      skills
        .filter((skill) => skill.kind === "hit")
        .map((skill) => skill.id)
        .sort()
    )
    for (const entry of assignments)
      expect(effects.some((effect) => effect.id === entry.effect)).toBe(true)
    expect(Object.keys(statusEffects).sort()).toEqual([...statusKinds].sort())
  })

  it("素手・射撃・斬撃・大きな一撃を分け、未登録の遠隔攻撃にも表示がある", () => {
    const skill = (slug: string) => skills.find((entry) => entry.slug === slug)!
    expect(attackEffect()).toBe("comic-hit")
    expect(attackEffect({ id: skill("magicbullet").id })).toBe("comic-shot")
    expect(attackEffect({ id: skill("flurry").id })).toBe("comic-slash")
    expect(attackEffect({ id: skill("helmsplit").id })).toBe("comic-critical")
    expect(attackEffect({ id: "unregistered", reach: "ranged" })).toBe(
      "comic-magic"
    )
    expect(attackEffect(undefined, { effect: { type: "damage" } })).toBe(
      "comic-critical"
    )
  })
})

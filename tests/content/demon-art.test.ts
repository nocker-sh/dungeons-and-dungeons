import { describe, expect, it } from "vite-plus/test"
import demons from "@/content/data/demons.json"
import { personOf } from "@/content/looks/person-of"
import { portraitOf } from "@/content/looks/portrait-of"
import { skillPortraitOf } from "@/content/looks/skill-portrait-of"

describe("悪魔の上半身とワザ画像", () => {
  it("通常は上半身を使い、全身の参照を保持する", () => {
    for (const demon of demons) {
      const person = personOf(demon.id)!
      expect(portraitOf(demon.id)).toBe(person.bustPortraits?.normal)
      expect(person.portraits?.normal).not.toBe(portraitOf(demon.id))
    }
  })

  it("全ワザを悪魔本人の画像へ割り当て、共通ワザでも別人にならない", () => {
    for (const demon of demons) {
      const images = demon.skills.map((skill) => {
        const image = skillPortraitOf(demon.id, skill)
        expect(image).toBe(personOf(demon.id)?.skillPortraits?.[skill])
        expect(image).toContain(`_${demon.slug}_skill_`)
        return image
      })
      expect(new Set(images).size).toBe(demon.skills.length)
    }
  })

  it("未登録のワザは本人の通常上半身へ戻す", () => {
    for (const demon of demons)
      expect(skillPortraitOf(demon.id, "unknown-skill")).toBe(
        portraitOf(demon.id)
      )
  })
})

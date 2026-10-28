import { describe, expect, it } from "vite-plus/test"
import { characterGroups } from "@/concept/characters"
import { portraitFor } from "@/concept/portraits"
import { resolvePortrait, portraitStates } from "@/concept/portrait-types"

const companions = characterGroups
  .filter(
    (group) => group.label === "キャラの一覧" || group.label === "募集の仲間"
  )
  .flatMap((group) => group.characters)

describe("宿の寝間着", () => {
  it("話者や表情に合う寝間着を選び、日常の表情を全員分持つ", () => {
    expect(companions.length).toBeGreaterThan(0)
    for (const character of companions) {
      const sleepwear = character.costumePortraits?.find(
        (costume) => costume.slug === "sleepwear"
      )
      expect(sleepwear, character.name).toBeDefined()
      for (const expression of [
        "talk",
        "happy",
        "sigh",
        "angry",
        "surprised",
        "surprisedLarge",
        "thinking",
        "shy",
      ] as const) {
        expect(sleepwear!.portraits?.[expression], character.name).toBeTruthy()
        expect(sleepwear!.portraits?.[expression]).not.toBe(sleepwear!.image)
      }
      for (const { value } of portraitStates) {
        expect(portraitFor(character.id, value, "sleepwear")).toBe(
          value !== "skill"
            ? (sleepwear!.portraits?.[value] ?? sleepwear!.image)
            : sleepwear!.image
        )
      }
    }
  })

  it("表情差分がない住民の部屋着は、部屋着の通常へ戻る", () => {
    const residents = characterGroups
      .filter((group) => group.label === "街の住人")
      .flatMap((group) => group.characters)
    expect(residents.length).toBeGreaterThan(0)
    for (const resident of residents) {
      const roomwear = resident.costumePortraits?.find(
        (costume) => costume.slug === "roomwear"
      )
      expect(roomwear).toBeDefined()
      expect(portraitFor(resident.id, "shy", "roomwear")).toBe(roomwear!.image)
    }
  })

  it("宿以外と未登録の衣装では元の表情画像を保つ", () => {
    for (const character of companions) {
      for (const { value } of portraitStates) {
        const original = resolvePortrait(
          character.portraits!,
          value,
          character.bustPortraits
        )
        expect(portraitFor(character.id, value)).toBe(original)
        expect(portraitFor(character.id, value, "missing-costume")).toBe(
          original
        )
      }
    }
  })
})

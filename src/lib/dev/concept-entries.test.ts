import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { conceptEntries } from "@/lib/concept/database"
import { devConceptEntries } from "./concept-entries"

describe("モンスターの個体別devページ", () => {
  it("全デザインを重複なく独立したURLへ分け、本人の全状態を持つ", () => {
    const monsters = conceptEntries.filter((entry) => entry.category === "敵")
    const pages = devConceptEntries.filter((entry) => entry.category === "敵")
    const expectedImages = new Set(
      monsters.flatMap((entry) => [
        entry.image,
        ...(entry.appearances ?? []).map((appearance) => appearance.image),
      ])
    )
    expect(pages).toHaveLength(expectedImages.size)
    expect(new Set(pages.map((entry) => entry.slug)).size).toBe(pages.length)
    expect(new Set(pages.map((entry) => entry.image))).toEqual(expectedImages)
    for (const page of pages) {
      expect(page.appearances).toBeUndefined()
      const images = [
        page.image,
        ...(page.attackImages?.length ? page.attackImages : [page.attackImage]),
        page.sleepingImage,
        page.defeatedImage,
      ]
      for (const image of images) {
        expect(image, page.slug).toBeTruthy()
        expect(existsSync(resolve("public" + image!)), page.slug).toBe(true)
      }
    }
  })

  it("ゲームの個体差データを維持し、横長と縦長を別ページで確認できる", () => {
    const source = conceptEntries.find((entry) => entry.slug === "black-slime")!
    expect(source.appearances).toHaveLength(2)
    for (const slug of ["black-slime-wide", "black-slime-tall"]) {
      const page = devConceptEntries.find((entry) => entry.slug === slug)!
      const individual = source.appearances!.find(
        (appearance) => appearance.image === page.image
      )!
      expect(page.attackImages).toEqual(individual.attackImages)
      expect(page.sleepingImage).toBe(individual.sleepingImage)
      expect(page.defeatedImage).toBe(individual.defeatedImage)
    }
  })
})

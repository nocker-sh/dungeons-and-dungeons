import { existsSync } from "node:fs"
import { resolve } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vite-plus/test"
import world from "@/concept/data/world.json"
import type { ConceptEntry } from "@/concept/database"
import { FOE_ART } from "@/content/looks/combat-art"
import { foeAppearance } from "@/content/foe-appearance"
import { foeAttackImage } from "@/content/foe-attack-image"
import { FoeArt } from "@/client/components/screens/battle/foe-art"

describe("モンスターの状態画像", () => {
  it("全種・全個体が通常・攻撃・睡眠・戦闘不能の実ファイルを持つ", () => {
    for (const monster of world.filter((entry) => entry.category === "敵")) {
      const individuals: Pick<
        ConceptEntry,
        | "image"
        | "attackImage"
        | "attackImages"
        | "sleepingImage"
        | "defeatedImage"
      >[] = [monster, ...(monster.appearances ?? [])]
      for (const individual of individuals) {
        const attacks = individual.attackImages?.length
          ? individual.attackImages
          : [individual.attackImage]
        const images = [
          individual.image,
          ...attacks,
          individual.sleepingImage,
          individual.defeatedImage,
        ]
        for (const image of images) {
          expect(image, `${monster.slug}: ${individual.image}`).toBeTruthy()
          expect(existsSync(resolve("public" + image!)), image).toBe(true)
        }
        expect(new Set(images).size, monster.slug).toBe(images.length)
      }
    }
  })

  it("実戦の各個体で攻撃・睡眠・戦闘不能の画像へ切り替わる", () => {
    const active = new Set(
      world.filter((entry) => entry.category === "敵").map((entry) => entry.id)
    )
    for (const [foe, base] of Object.entries(FOE_ART)) {
      if (!active.has(foe)) continue
      const individuals = [base, ...(base.appearances ?? [])]
      const identifiers = new Map<string | undefined, string | undefined>([
        [base.img, undefined],
      ])
      for (let index = 0; index < individuals.length * 10; index++) {
        const identifier = `art-check-${index}`
        identifiers.set(foeAppearance(foe, identifier)?.img, identifier)
      }
      for (const individual of individuals) {
        expect(identifiers.has(individual.img), foe).toBe(true)
        const appearanceId = identifiers.get(individual.img)
        const appearance = foeAppearance(foe, appearanceId)
        const attacks = individual.attacks?.length
          ? individual.attacks
          : [individual.attack]
        for (const [pattern, attack] of attacks.entries()) {
          expect(foeAttackImage(appearance, pattern), foe).toBe(attack)
          expect(attack, foe).toBeTruthy()
          expect(
            renderToStaticMarkup(
              <FoeArt
                foe={foe}
                appearanceId={appearanceId}
                attacking
                attackPattern={pattern}
              />
            )
          ).toContain(`src="${attack}"`)
        }
        for (const state of ["sleeping", "defeated"] as const) {
          expect(individual[state], foe).toBeTruthy()
          expect(
            renderToStaticMarkup(
              <FoeArt
                foe={foe}
                appearanceId={appearanceId}
                {...{ [state]: true }}
              />
            )
          ).toContain(`src="${individual[state]}"`)
        }
      }
    }
  })
})

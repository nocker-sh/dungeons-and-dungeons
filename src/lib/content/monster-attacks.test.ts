import { existsSync } from "node:fs"
import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  aState,
  contentId,
  createTestGame,
  eventsOrThrow,
} from "@/lib/wiz/testing"
import { gameContent } from "@/lib/content/game-content"
import { foeAppearance, foeAttackImage } from "@/lib/content/foe-appearance"
import world from "@/lib/concept/data/world.json"
import type { ConceptEntry } from "@/lib/concept/database"

const monsters = world as ConceptEntry[]

describe("敵の攻撃と画像の対応", () => {
  it.each(
    gameContent.foes.flatMap((definition) =>
      [0, 1].map((rate) => ({ definition, rate }))
    )
  )(
    "敵 $definition.id・ワザ率 $rate の数値結果と乱数消費を、呼び名のない従来データと保つ",
    ({ definition, rate }) => {
      const results = [false, true].map((legacy) => {
        const content = aContent()
          .withFoe(definition.id, {
            skillRate: rate,
            ...(legacy ? { attack: undefined, skillNames: undefined } : {}),
          })
          .build()
        let rolls = 0
        const game = createTestGame({
          content,
          random: () => {
            rolls++
            return 0.5
          },
          state: aState()
            .inBattle({
              foes: [definition.id],
              order: ["foe-1", "hero", "alda", "mort"],
            })
            .build(),
        })
        const events = eventsOrThrow(game.send({ type: "foe-turn" }))
        return {
          rolls,
          state: game.state,
          events: events.map((event) =>
            event.type === "acted" ? { ...event, name: "" } : event
          ),
        }
      })
      expect(results[0], definition.id).toEqual(results[1])
    }
  )

  it("現役の全種・全個体が、使えるワザIDごとに実画像を持つ", () => {
    for (const definition of gameContent.foes) {
      const entry = monsters.find((monster) => monster.id === definition.id)!
      if (entry.category !== "敵") continue
      expect(entry.attack?.name, entry.slug).toBeTruthy()
      for (const individual of [entry, ...(entry.appearances ?? [])]) {
        for (const skill of definition.skills ?? []) {
          const image = individual.skillPortraits?.[skill]
          expect(
            image,
            `${entry.slug}: ${individual.image}: ${skill}`
          ).toBeTruthy()
          expect(existsSync(`public${image}`), image).toBe(true)
        }
      }
    }
  })

  it("実際に選んだ殻ぶつけと粘液まきで絵が変わり、同じ攻撃は巡回しない", () => {
    const foe = gameContent.foes.find(
      (entry) => entry.id === contentId("makigaitsu")
    )!
    const images: string[] = []
    for (const skill of foe.skills!) {
      const content = aContent()
        .withFoe("makigaitsu", { skills: [skill], skillRate: 1 })
        .build()
      const game = createTestGame({
        content,
        random: 0.5,
        state: aState()
          .inBattle({
            foes: ["makigaitsu"],
            order: ["foe-1", "hero", "alda", "mort"],
          })
          .build(),
      })
      const acted = eventsOrThrow(game.send({ type: "foe-turn" })).find(
        (event) => event.type === "acted"
      )!
      expect(acted.skill).toBe(skill)
      const appearance = foeAppearance(foe.id)
      const image = foeAttackImage(appearance, { skill: acted.skill })!
      expect(image).toBe(
        monsters.find((entry) => entry.id === foe.id)!.skillPortraits![skill]
      )
      expect(foeAttackImage(appearance, { skill: acted.skill })).toBe(image)
      images.push(image)
    }
    expect(new Set(images).size).toBe(2)
  })

  it("通常攻撃と本人に合わせたワザ名を、既存の効果で返す", () => {
    for (const special of [false, true]) {
      const content = aContent()
        .withFoe("kamokutsu", { skillRate: special ? 1 : 0 })
        .build()
      const game = createTestGame({
        content,
        random: 0.5,
        state: aState()
          .inBattle({
            foes: ["kamokutsu"],
            order: ["foe-1", "hero", "alda", "mort"],
          })
          .build(),
      })
      const acted = eventsOrThrow(game.send({ type: "foe-turn" })).find(
        (event) => event.type === "acted"
      )!
      expect(acted.name).toBe(special ? "長靴の蹴り" : "長靴キック")
      expect(acted.command).toBe(special ? "skill" : "attack")
      expect(acted.results).toHaveLength(1)
    }
  })

  it("未知のワザは同じ個体の通常攻撃へ戻り、別個体の画像を借りない", () => {
    const snail = contentId("makigaitsu")
    for (let index = 0; index < 10; index++) {
      const appearance = foeAppearance(snail, `reference-${index}`)!
      expect(foeAttackImage(appearance, { skill: "unknown-skill" })).toBe(
        appearance.attack
      )
      expect(foeAttackImage(appearance, {})).toBe(appearance.attack)
    }
  })
})

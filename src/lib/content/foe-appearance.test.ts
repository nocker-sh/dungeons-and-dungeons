import { describe, expect, it } from "vite-plus/test"
import { contentSource } from "@/lib/content/game-content"
import { foeAppearance, foeAttackImage } from "@/lib/content/foe-appearance"
import { aContent, createTestGame, eventsOrThrow } from "@/lib/wiz/testing"

const slime = contentSource.foes.find((foe) => foe.slug === "black-slime")!

describe("敵の個体差", () => {
  it("別個体の姿を選び、同じ個体の再描画で固定する。旧保存は元の姿", () => {
    expect(foeAppearance(slime.id)?.img).toBe(
      "/images/enemy_47_black-slime.webp"
    )
    const images = new Set(
      Array.from(
        { length: 20 },
        (_, index) => foeAppearance(slime.id, `individual-${index}`)?.img
      )
    )
    expect(images.size).toBe(3)
    const art = foeAppearance(slime.id, "individual-4")
    expect(foeAppearance(slime.id, "individual-4")).toEqual(art)
    expect(art?.attacks).toHaveLength(2)
    expect(foeAttackImage(art, 0)).not.toBe(foeAttackImage(art, 1))
    expect(foeAttackImage(art, 2)).toBe(foeAttackImage(art, 0))
    for (const image of art!.attacks!)
      expect(image).toMatch(
        new RegExp(art!.img!.replace(".webp", "") + "_attack-")
      )
  })

  it("同時出現する個体に別IDを与え、保存再開後も姿と能力を保つ", () => {
    const content = aContent()
      .withStation("layer0", "n1", {
        foes: [slime.id, slime.id],
      })
      .build()
    let rolls = 0
    const game = createTestGame({
      content,
      random: () => {
        rolls++
        return 0.5
      },
    })
    const layer = content.layers[0]
    eventsOrThrow(game.send({ type: "depart", layer: layer.id }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const view = game.queries.battle(game.state)!
    expect(view.foes[0].appearanceId).toBeTruthy()
    expect(view.foes[0].appearanceId).not.toBe(view.foes[1].appearanceId)
    expect(foeAppearance(slime.id, view.foes[0].appearanceId)?.img).not.toBe(
      foeAppearance(slime.id, view.foes[1].appearanceId)?.img
    )
    expect(view.foes.map((foe) => foe.maxHp)).toEqual([slime.hp, slime.hp])
    expect(rolls).toBe(0)
    const resumed = createTestGame({ content, state: game.state })
    expect(resumed.queries.battle(resumed.state)?.foes).toEqual(view.foes)
    const save = game.save()
    expect(resumed.restore(save)).toBeUndefined()
    expect(resumed.queries.battle(resumed.state)?.foes).toEqual(view.foes)
  })
})

describe("ヴルムの大人の姿", () => {
  it("通常戦の既存IDで大人を含む3姿を選び、旧保存の姿と能力を保持する", () => {
    const foe = contentSource.foes.find((foe) => foe.slug === "hanenashin")!
    const before = JSON.stringify(foe)
    const images = new Set(
      Array.from(
        { length: 30 },
        (_, index) => foeAppearance(foe.id, `individual-${index}`)?.img
      )
    )
    expect(images).toEqual(
      new Set([
        "/images/enemy_54_hanenashin.webp",
        "/images/enemy_90_hanenashin-stone.webp",
        "/images/enemy_89_hanenashin-adult.webp",
      ])
    )
    expect(foeAppearance(foe.id)?.img).toBe("/images/enemy_54_hanenashin.webp")
    expect(JSON.stringify(foe)).toBe(before)
  })
})

import { describe, expect, it } from "vite-plus/test"
import { contentSource } from "@/content/game-content"
import { foeAppearance } from "@/content/foe-appearance"
import { battleSceneOf } from "@/content/looks/battle-scene-of"
import { sceneOf } from "@/content/looks/scene-of"
import { FOE_ART } from "@/content/looks/combat-art"
import { shopLook } from "@/content/looks/shop-look"
import { street } from "@/content/looks/street"
import { frameOf } from "@/content/looks/frame-of"
import { studioArtwork } from "@/development/studio/artwork"
import { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import { createStudioStart } from "@/development/studio/create-studio-start"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"

describe("場面ごとの敵画像の先読み", () => {
  const slime = contentSource.foes.find((foe) => foe.slug === "black-slime")!
  const duck = contentSource.foes.find((foe) => foe.slug === "kamokutsu")!

  it("戦闘では現在の背景を先読みし、ギルドや無関係な店員を起動条件にしない", () => {
    const start = createStudioStart(parseStudioConfig({ scene: "battle" }))
    const state = start.initialState!
    if (state.phase.type !== "battle") throw new Error("戦闘状態がない")
    const paths = studioArtwork(start)
    expect(paths).toContain(battleSceneOf(state.phase.expedition.layer))
    expect(paths).toContain(battleSceneOf(state.phase.expedition.layer, true))
    expect(paths).not.toContain(sceneOf("guild"))
    for (const shop of street())
      for (const keeper of shopLook(shop).keepers)
        expect(paths).not.toContain(frameOf(keeper).img)
  })

  it("保存だけで開くフレームも、復元した隊列と敵の画像を先読みする", () => {
    const start = createStudioStart(parseStudioConfig({ scene: "battle" }))
    expect(start.save).toBeDefined()
    expect(studioArtwork({ ...start, initialState: undefined })).toEqual(
      studioArtwork(start)
    )
  })

  it("保存の先読みが本番フレーム用の乱数・時計・IDを消費しない", () => {
    const start = createStudioStart(parseStudioConfig({ scene: "battle" }))
    const unused = () => {
      throw new Error("フレーム用の環境を消費した")
    }
    const environment = WizWorldEnvironment.create({
      random: unused,
      now: unused,
      nextId: unused,
    })
    expect(
      studioArtwork({ ...start, initialState: undefined, environment })
    ).toEqual(studioArtwork(start))
  })

  it("店ではその店の背景と店員を先読みし、別の店の背景を含めない", () => {
    const [selected, other] = street()
    const start = createStudioStart(parseStudioConfig({ scene: "town" }))
    const paths = studioArtwork({
      ...start,
      screen: { name: "shop", shop: selected },
    })
    expect(paths).toContain(shopLook(selected).scene)
    expect(paths).toContain(shopLook(selected, true).scene)
    for (const keeper of shopLook(selected).keepers)
      expect(paths).toContain(frameOf(keeper).img)
    expect(paths).not.toContain(shopLook(other).scene)
  })

  it("街の起動では、登場しない敵の画像を読み込まない", () => {
    const start = createStudioStart(parseStudioConfig({ scene: "town" }))
    const paths = studioArtwork(start)
    expect(paths).not.toContain(foeAppearance(duck.id)!.img)
    expect(paths).not.toContain(foeAppearance(slime.id)!.img)
  })

  it("依頼一覧には敵の通常姿を用意し、戦闘の差分は先読みしない", () => {
    const start = createStudioStart(
      parseStudioConfig({ scene: "quick-quests" })
    )
    const paths = studioArtwork(start)
    for (const quest of start.content!.quests) {
      const art = foeAppearance(quest.foe)!
      expect(paths).toContain(art.img)
      if (art.attack && art.attack !== art.img)
        expect(paths).not.toContain(art.attack)
    }
  })

  it.each(Array.from({ length: 6 }, (_, i) => `individual-${i}`))(
    "%s の通常・攻撃・ワザ・睡眠・戦闘不能画像を保ち、別の敵を除く",
    (appearanceId) => {
      const start = createStudioStart(
        parseStudioConfig({ foes: ["black-slime"] })
      )
      const state = start.initialState!
      if (state.phase.type !== "battle") throw new Error("戦闘状態がない")
      const initialState = {
        ...state,
        phase: {
          ...state.phase,
          battle: {
            ...state.phase.battle,
            foes: state.phase.battle.foes.map((foe) => ({
              ...foe,
              appearanceId,
            })),
          },
        },
      }
      const before = JSON.stringify(initialState)
      const paths = studioArtwork({ ...start, initialState })
      const art = foeAppearance(slime.id, appearanceId)!
      for (const path of [
        art.img,
        art.attack,
        art.sleeping,
        art.defeated,
        ...(art.attacks ?? []),
        ...Object.values(art.skills ?? {}),
      ]) {
        if (path) expect(paths).toContain(path)
      }
      expect(paths).not.toContain(foeAppearance(duck.id)!.img)
      for (const variant of [
        FOE_ART[slime.id],
        ...(FOE_ART[slime.id].appearances ?? []),
      ])
        if (variant.img !== art.img) expect(paths).not.toContain(variant.img)
      expect(new Set(paths).size).toBe(paths.length)
      expect(JSON.stringify(initialState)).toBe(before)
    }
  )
})

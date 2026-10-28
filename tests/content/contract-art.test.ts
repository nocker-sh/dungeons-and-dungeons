import { describe, expect, it } from "vite-plus/test"
import { characterGroups } from "@/concept/characters"
import { gameContent } from "@/content/game-content"
import { frameOf } from "@/content/looks/frame-of"
import { portraitOf } from "@/content/looks/portrait-of"
import { BattleRules } from "@/lib/wiz/rules/battle-rules"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import { aState } from "@/lib/wiz/testing/state-builder"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"

describe("ケイヤクの戦闘通常画像", () => {
  it("タンクを含むモードの仲間は、前衛で敵を引き受ける重みが大きい", () => {
    const alma = memberBySlug("alma").id
    const nem = memberBySlug("nem").id
    const state = aState()
      .withExtraMember("alma", { lv: 12 })
      .withExtraMember("nem", { lv: 12 })
      .build()
    const ready = (id: string) => ({
      ...state.members.find((member) => member.id === id)!,
      mode: 0,
      hp: 100,
      status: [],
    })
    const catalog = new GameCatalog(gameContent)
    const rules = new BattleRules(catalog, new PartyRules(catalog))
    // アルマはダメージ、ネムはタンクを含む。並びの順に関わらずネムが狙われる
    expect(rules.target([ready(alma), ready(nem)], () => 0.6)?.id).toBe(nem)
    expect(rules.target([ready(nem), ready(alma)], () => 0.6)?.id).toBe(nem)
  })
  it("R全員のモード（1人1つ）が戦い方に対応し、モードの立ち絵と札で戦う", () => {
    const characters = characterGroups
      .flatMap((group) => group.characters)
      .filter((character) => character.rarity === "R")
    expect(characters).toHaveLength(6)
    for (const character of characters) {
      const recruit = gameContent.recruits.find(
        (entry) => entry.member.id === character.id
      )!
      expect(character.contractModes).toHaveLength(1)
      expect(character.contractModes![0]!.battlePortrait).not.toBe(
        character.bustPortraits?.normal
      )
      expect(
        character.contractModes!.map((mode) => ({
          level: mode.level,
          weapon: mode.weapon,
          roles: mode.roles,
          combatStyle: mode.combatStyle,
        }))
      ).toEqual(
        recruit.member.pact!.modes.map((mode) => ({
          ...mode,
          roles: mode.roles?.map(
            (role) =>
              ({
                tank: "タンク",
                damage: "ダメージ",
                healer: "ヒール",
                summoner: "召喚",
              })[role]
          ),
        }))
      )
      expect(
        new Set(character.contractModes!.map((mode) => mode.battlePortrait))
          .size
      ).toBe(1)
      for (const [index, mode] of character.contractModes!.entries()) {
        expect(mode.bargain?.partner).toBeTruthy()
        expect(mode.bargain?.borrow).toBeTruthy()
        expect(mode.bargain?.price).toBeTruthy()
        expect(mode.name).toBe(
          gameContent.goods.find((good) => good.id === mode.weapon)?.name
        )
        const frame = frameOf(character.id, undefined, index)
        expect(frame.img).toBe(mode.battlePortrait)
        expect(frame.bust).toBe(mode.battlePortrait)
      }
      expect(frameOf(character.id).img).toBe(portraitOf(character.id))
      expect(frameOf(character.id, undefined, 99).img).toBe(
        portraitOf(character.id)
      )
    }
  })
})

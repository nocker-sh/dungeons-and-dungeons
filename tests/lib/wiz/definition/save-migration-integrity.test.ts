import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { StateIntegrityError } from "@/lib/wiz/integrity/state-integrity-error"
import type { Gear } from "@/lib/wiz/state/state-schema"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"

const definition = new GameDefinition(realContent())
const alma = contentId("alma")
const good = memberBySlug("alma").pact!.modes[0].weapon
const signature: Gear = {
  id: "legacy-signature",
  good,
  owner: alma,
  plus: realContent().balance.unique.maxPlus,
  progress: realContent().balance.unique.progressPerStep - 1,
  wear: 0,
  weapon: definition.rules.weapons.forGoodId(good),
}

function legacy() {
  const state = aState().withExtraMember("alma").build()
  return { ...state, gear: [...state.gear, signature] }
}

describe("保存移行前の整合性", () => {
  describe.each([
    definition.identity,
    definition.previousIdentity,
    definition.legacyIdentity,
  ])("戦闘の個体と手番: %s", (contentVersion) => {
    const battleState = () =>
      aState()
        .inBattle({ foes: ["kamokutsu", "kamokutsu"] })
        .build()

    it("同じ種類の敵も個体が違えば保存から復元できる", () => {
      const game = createTestGame()
      const snapshot = battleState()
      expect(
        game.restore({ ...game.save(), contentVersion, snapshot })
      ).toBeUndefined()
      expect(game.state).toEqual(snapshot)
    })

    it.each(["foes", "order"] as const)(
      "%s の重複を拒否し、読み込み前の状態を残す",
      (field) => {
        const game = createTestGame()
        const state = battleState()
        if (state.phase.type !== "battle") throw new Error("戦闘ではない")
        const battle = state.phase.battle
        const duplicate =
          field === "foes"
            ? {
                ...battle,
                foes: [...battle.foes, structuredClone(battle.foes[0])],
              }
            : { ...battle, order: [...battle.order, { ...battle.order[0] }] }
        const before = game.state
        const error = game.restore({
          ...game.save(),
          contentVersion,
          snapshot: { ...state, phase: { ...state.phase, battle: duplicate } },
        })
        expect(error).toBeInstanceOf(GameCommandError)
        if (!(error instanceof GameCommandError))
          throw new Error("重複した戦闘を読み込んだ")
        expect(error.cause).toBeInstanceOf(StateIntegrityError)
        if (!(error.cause instanceof StateIntegrityError))
          throw new Error("保存の不正な箇所が分からない")
        expect(error.cause.problems).toContain(
          field === "foes" ? "敵の個体が重複している" : "行動順が重複している"
        )
        expect(game.state).toBe(before)
      }
    )
  })

  it.each([
    definition.identity,
    definition.previousIdentity,
    definition.legacyIdentity,
  ])(
    "対応している各版で、不正な内容を版違いと誤診しない: %s",
    (contentVersion) => {
      const game = createTestGame()
      const state = aState().build()
      const before = game.state
      const error = game.restore({
        ...game.save(),
        contentVersion,
        snapshot: { ...state, party: [...state.party, state.party[1]] },
      })
      expect(error).toBeInstanceOf(GameCommandError)
      if (!(error instanceof GameCommandError))
        throw new Error("保存が拒否されなかった")
      const cause = error.cause
      expect(cause).toBeInstanceOf(StateIntegrityError)
      if (!(cause instanceof StateIntegrityError))
        throw new Error("保存の不正な箇所が分からない")
      expect(cause.problems).toContain("出撃メンバーが重複している")
      expect(game.state).toBe(before)
    }
  )

  it("強化・鍛え直し済みの旧契約武器も移行できる", () => {
    const game = createTestGame()
    const old = legacy()
    expect(game.restore({ ...game.save(), snapshot: old })).toBeUndefined()
    expect(game.state.gear).toEqual(
      old.gear.filter((gear) => gear.id !== signature.id)
    )
    expect(game.state.gold).toBe(old.gold)
    expect(game.state.members).toEqual(old.members)
  })

  it.each([
    "duplicate-id",
    "duplicate-slot",
    "unhired-owner",
    "unknown-skill",
    "unidentified",
    "over-upgraded",
  ])("取り除く旧契約武器の不正も拒否する: %s", (kind) => {
    const old = legacy()
    let gear = old.gear
    if (kind === "duplicate-id") gear = [...gear, signature]
    else if (kind === "duplicate-slot")
      gear = [...gear, { ...signature, id: "second" }]
    else
      gear = gear.map((entry) => {
        if (entry.id !== signature.id) return entry
        if (kind === "unknown-skill")
          return {
            ...entry,
            weapon: {
              ...entry.weapon!,
              skills: [
                entry.weapon!.skills[0],
                "missing",
                entry.weapon!.skills[2],
              ],
            },
          }
        if (kind === "unidentified") return { ...entry, unidentified: true }
        if (kind === "over-upgraded")
          return { ...entry, plus: signature.plus + 1 }
        return entry
      })
    const members =
      kind === "unhired-owner"
        ? old.members.filter((member) => member.id !== alma)
        : old.members
    const game = createTestGame()
    const before = game.state
    expect(
      game.restore({ ...game.save(), snapshot: { ...old, gear, members } })
    ).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
  })
})

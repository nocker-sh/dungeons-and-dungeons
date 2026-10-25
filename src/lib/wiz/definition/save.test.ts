import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  contentId,
  createTestPlay,
  eventsOrThrow,
  realContent,
} from "@/lib/wiz/testing"
import {
  GameCommandError,
  StateIntegrityError,
  GameDefinition,
  SAVE_REVISION,
  type GameState,
} from "@/lib/wiz"
import { WizRpgComponentIdentity } from "@/lib/wiz/core/rpg/component-identity"

describe("保存", () => {
  it("保存の形の版は dungeons-state-11（ギルド登録待ちを保存する）", () => {
    expect(SAVE_REVISION).toBe("dungeons-state-11")
  })

  it("武器の個体がなかった古い保存（dungeons-state-5）は読み込まず、今の状態も残す", () => {
    const { game } = createTestPlay()
    const old = {
      schemaVersion: 1,
      contentVersion: WizRpgComponentIdentity.create(
        "rules-1",
        Object.freeze({ save: "dungeons-state-5" })
      ).digest,
      snapshot: JSON.parse(JSON.stringify(game.state)),
    }
    const before = game.state
    const error = game.restore(old)
    expect(error).toBeInstanceOf(GameCommandError)
    expect((error as GameCommandError).code).toBe("INVALID_SAVE")
    expect(game.state).toBe(before)
  })

  it("今の版でも、MPや攻撃を持つ古い形の状態は読み込まない", () => {
    const { game, definition } = createTestPlay()
    const base = definition.initialState()
    const stale = {
      ...JSON.parse(JSON.stringify(game.save())),
      snapshot: {
        ...JSON.parse(JSON.stringify(base)),
        members: base.members.map((member) => ({
          ...member,
          mp: 10,
          stats: { ...member.stats, maxMp: 10, atk: 5, def: 3 },
        })),
      },
    }
    const before = game.state
    expect(game.restore(stale)).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
  })

  it("武器の個体を持たない古い形の装備がある状態は読み込まない", () => {
    const { game } = createTestPlay()
    const base = JSON.parse(JSON.stringify(game.state)) as GameState
    const stale = {
      ...JSON.parse(JSON.stringify(game.save())),
      snapshot: {
        ...base,
        gear: base.gear.map((gear) => {
          const { weapon: _weapon, ...rest } = gear
          return rest
        }),
      },
    }
    const before = game.state
    expect(game.restore(stale)).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
  })

  it("耐久を持たない古い形の装備がある状態は読み込まない", () => {
    const { game } = createTestPlay()
    const base = JSON.parse(JSON.stringify(game.state)) as GameState
    const stale = {
      ...JSON.parse(JSON.stringify(game.save())),
      snapshot: {
        ...base,
        gear: base.gear.map((gear) => {
          const { wear: _wear, ...rest } = gear
          return rest
        }),
      },
    }
    const before = game.state
    expect(game.restore(stale)).toBeInstanceOf(GameCommandError)
    expect(game.state).toBe(before)
  })

  it("途中の戦闘も保存・復元でき、壊れたデータは読み込まない", () => {
    const { game, definition } = createTestPlay()
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    eventsOrThrow(game.send({ type: "advance", to: "n1" }))
    const save = JSON.parse(JSON.stringify(game.save()))
    const other = definition.create()
    expect(other.restore(save)).toBeUndefined()
    expect(other.state).toEqual(game.state)
    const broken = { ...save, snapshot: { ...save.snapshot, gold: -1 } }
    const before = other.state
    expect(other.restore(broken)).toBeInstanceOf(GameCommandError)
    expect(other.state).toBe(before)
  })

  it("コンテンツの数値や名前を直しても、保存は読み込めて新しい名前が出る", () => {
    const { game } = createTestPlay()
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    const alda = contentId("alda")
    const edited = new GameDefinition(
      aContent()
        .withStartingGold(1)
        .withRecruitMember("alda", { name: "別の名前" })
        .build()
    ).create()
    expect(
      edited.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeUndefined()
    expect(edited.state.gold).toBe(game.state.gold)
    expect(edited.queries.member(edited.state, alda)?.name).toBe("別の名前")
  })

  it("保存が指す品物がコンテンツから消えたら読み込まず、理由を返す", () => {
    const { game } = createTestPlay()
    eventsOrThrow(
      game.send({
        type: "buy",
        shop: contentId("armory"),
        good: contentId("dagger"),
      })
    )
    const removed = new GameDefinition(
      aContent().withoutGood("dagger").build()
    ).create()
    const error = removed.restore(JSON.parse(JSON.stringify(game.save())))
    expect(error).toBeInstanceOf(GameCommandError)
    expect((error as GameCommandError).cause).toBeInstanceOf(
      StateIntegrityError
    )
    expect(
      ((error as GameCommandError).cause as StateIntegrityError).problems
    ).toContain(`装備 ${contentId("dagger")} がコンテンツにない`)
  })

  it("規則の版が違う保存は読み込まない", () => {
    const { game } = createTestPlay()
    const other = new GameDefinition(realContent(), {
      rules: {},
      rulesRevision: "rules-other",
    }).create()
    expect(
      other.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeInstanceOf(GameCommandError)
  })
})

import { describe, expect, it } from "vite-plus/test"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import type { WizVaultPlayerState } from "@/lib/wiz/core/vault/states/player/schema"
import { WizVaultPlayer } from "@/lib/wiz/core/vault/states/player/value"

const createTestPlayer = (): WizVaultPlayerState => ({
  name: "テスト勇者",
  level: 1,
  exp: 0,
  expToNextLevel: 100,
  hp: 50,
  maxHp: 50,
  mp: 20,
  maxMp: 30,
  hunger: 100,
  ap: 5,
  maxAp: 5,
  gold: 100,
  attributes: {
    strength: 5,
    dexterity: 5,
    agility: 5,
    vitality: 5,
    wisdom: 5,
    charisma: 5,
  },
  abilityIds: [],
})

describe("getters", () => {
  it("プロパティを取得できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.name).toBe("テスト勇者")
    expect(player.level).toBe(1)
    expect(player.hp).toBe(50)
    expect(player.maxHp).toBe(50)
    expect(player.mp).toBe(20)
    expect(player.maxMp).toBe(30)
    expect(player.gold).toBe(100)
  })

  it("constructor入力とnested getterを防御的に所有する", () => {
    const source = {
      ...createTestPlayer(),
      attributes: { ...createTestPlayer().attributes },
      abilityIds: Array<string>(),
    }
    const player = new WizVaultPlayer(source)

    source.hp = 0
    source.attributes.strength = 999
    source.abilityIds.push("forged")

    expect(player.hp).toBe(50)
    expect(player.attributes.strength).toBe(5)
    expect(player.abilityIds).toEqual([])
    expect(Object.isFrozen(player)).toBe(true)
    expect(Object.isFrozen(player.attributes)).toBe(true)
    expect(Object.isFrozen(player.abilityIds)).toBe(true)
  })
})

describe("invariants", () => {
  it("constructorで数値範囲と相関制約を一元検証する", () => {
    expect(
      () => new WizVaultPlayer({ ...createTestPlayer(), level: 0 })
    ).toThrow(WizValueValidationError)
    expect(
      () => new WizVaultPlayer({ ...createTestPlayer(), exp: -1 })
    ).toThrow(WizValueValidationError)
    expect(
      () => new WizVaultPlayer({ ...createTestPlayer(), expToNextLevel: 0 })
    ).toThrow(WizValueValidationError)
    expect(() => new WizVaultPlayer({ ...createTestPlayer(), hp: 51 })).toThrow(
      WizValueValidationError
    )
    expect(() => new WizVaultPlayer({ ...createTestPlayer(), mp: 31 })).toThrow(
      WizValueValidationError
    )
    expect(
      () => new WizVaultPlayer({ ...createTestPlayer(), maxMp: undefined })
    ).toThrow(WizValueValidationError)
    expect(
      () => new WizVaultPlayer({ ...createTestPlayer(), hunger: 101 })
    ).toThrow(WizValueValidationError)
    expect(() => new WizVaultPlayer({ ...createTestPlayer(), ap: 6 })).toThrow(
      WizValueValidationError
    )
    expect(
      () => new WizVaultPlayer({ ...createTestPlayer(), gold: Number.NaN })
    ).toThrow(WizValueValidationError)
    expect(
      () =>
        new WizVaultPlayer({
          ...createTestPlayer(),
          attributes: {
            ...createTestPlayer().attributes,
            strength: Number.POSITIVE_INFINITY,
          },
        })
    ).toThrow(WizValueValidationError)
    expect(
      () =>
        new WizVaultPlayer({
          ...createTestPlayer(),
          customAttributes: { luck: Number.NEGATIVE_INFINITY },
        })
    ).toThrow(WizValueValidationError)
    expect(
      () =>
        new WizVaultPlayer({
          ...createTestPlayer(),
          abilityIds: ["heal", "heal"],
        })
    ).toThrow(WizValueValidationError)
  })

  it("amount APIは負値と非有限値を拒否する", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const operations = [
      () => player.useAp(-1),
      () => player.restoreAp(-1),
      () => player.heal(-1),
      () => player.damage(-1),
      () => player.restoreMp(-1),
      () => player.addGold(-1),
      () => player.spendGold(-1),
      () => player.addExp(-1),
      () => player.canAfford(-1),
      () => player.hasAp(-1),
      () => player.heal(Number.NaN),
      () => player.addGold(Number.POSITIVE_INFINITY),
    ]

    for (const operation of operations) {
      expect(operation).toThrow(WizValueValidationError)
    }
  })
  it("setterとsigned delta APIは非有限値を拒否する", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const operations = [
      () => player.withHp(Number.NaN),
      () => player.withMp(Number.POSITIVE_INFINITY),
      () => player.withHunger(Number.NEGATIVE_INFINITY),
      () => player.withAp(Number.NaN),
      () => player.withMaxAp(-1),
      () => player.addHunger(Number.NaN),
      () => player.addAttribute("strength", Number.POSITIVE_INFINITY),
      () => player.withCustomAttribute("luck", Number.NaN),
      () => player.addCustomAttribute("luck", Number.NEGATIVE_INFINITY),
    ]

    for (const operation of operations) {
      expect(operation).toThrow(WizValueValidationError)
    }
  })

  it("maxApを縮小すると現在APも新しい上限へ収める", () => {
    const player = new WizVaultPlayer(createTestPlayer()).withMaxAp(2)

    expect(player.maxAp).toBe(2)
    expect(player.ap).toBe(2)
  })

  it("MPを持たないplayerへのMP変更は状態を増やさない", () => {
    const player = new WizVaultPlayer({
      ...createTestPlayer(),
      mp: undefined,
      maxMp: undefined,
    })

    expect(player.restoreMp(5)).toBe(player)
    expect(player.toPlain().mp).toBeUndefined()
    expect(player.toPlain().maxMp).toBeUndefined()
  })
})

describe("heal", () => {
  it("HPを回復する", () => {
    const player = new WizVaultPlayer({ ...createTestPlayer(), hp: 30 })
    const healed = player.heal(10)

    expect(healed.hp).toBe(40)
    expect(player.hp).toBe(30) // 元は変更されない
  })

  it("maxHpを超えない", () => {
    const player = new WizVaultPlayer({ ...createTestPlayer(), hp: 45 })
    const healed = player.heal(20)

    expect(healed.hp).toBe(50)
  })
})

describe("damage", () => {
  it("HPを減少させる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const damaged = player.damage(10)

    expect(damaged.hp).toBe(40)
  })

  it("0未満にならない", () => {
    const player = new WizVaultPlayer({ ...createTestPlayer(), hp: 5 })
    const damaged = player.damage(20)

    expect(damaged.hp).toBe(0)
  })
})

describe("withHp", () => {
  it("HPを直接設定する", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.withHp(25)

    expect(updated.hp).toBe(25)
  })

  it("maxHpを超えない", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.withHp(100)

    expect(updated.hp).toBe(50)
  })

  it("0未満にならない", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.withHp(-10)

    expect(updated.hp).toBe(0)
  })
})

describe("MP関連", () => {
  it("MPを直接設定し、範囲内に丸める", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.withMp(25).mp).toBe(25)
    expect(player.withMp(100).mp).toBe(30)
    expect(player.withMp(-10).mp).toBe(0)
    expect(player.mp).toBe(20)
  })

  it("MPを回復する", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.restoreMp(5).mp).toBe(25)
  })
})

describe("addGold / spendGold", () => {
  it("ゴールドを追加できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.addGold(50)

    expect(updated.gold).toBe(150)
  })

  it("ゴールドを消費できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.spendGold(30)

    expect(updated.gold).toBe(70)
  })

  it("ゴールドは0未満にならない", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.spendGold(200)

    expect(updated.gold).toBe(0)
  })
})

describe("addExp", () => {
  it("経験値を追加できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.addExp(50)

    expect(updated.exp).toBe(50)
  })
})

describe("addHunger", () => {
  it("満腹度を変更できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.addHunger(-20)

    expect(updated.hunger).toBe(80)
  })

  it("0-100の範囲に収まる", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.addHunger(50).hunger).toBe(100)
    expect(player.addHunger(-200).hunger).toBe(0)
  })
})

describe("AP関連", () => {
  it("APを消費できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.useAp(2)

    expect(updated.ap).toBe(3)
  })

  it("APを回復できる", () => {
    const player = new WizVaultPlayer({ ...createTestPlayer(), ap: 2 })
    const updated = player.restoreAp(2)

    expect(updated.ap).toBe(4)
  })

  it("APをリセットできる", () => {
    const player = new WizVaultPlayer({ ...createTestPlayer(), ap: 1 })
    const updated = player.resetAp()

    expect(updated.ap).toBe(5)
  })
})

describe("addAttribute", () => {
  it("ステータスを増加できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.addAttribute("strength", 3)

    expect(updated.attributes.strength).toBe(8)
  })
})

describe("判定メソッド", () => {
  it("isDead", () => {
    const alive = new WizVaultPlayer(createTestPlayer())
    const dead = new WizVaultPlayer({ ...createTestPlayer(), hp: 0 })

    expect(alive.isDead()).toBe(false)
    expect(dead.isDead()).toBe(true)
  })

  it("canAfford", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.canAfford(50)).toBe(true)
    expect(player.canAfford(100)).toBe(true)
    expect(player.canAfford(150)).toBe(false)
  })

  it("hasAp", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.hasAp(3)).toBe(true)
    expect(player.hasAp(5)).toBe(true)
    expect(player.hasAp(6)).toBe(false)
  })

  it("canLevelUp", () => {
    const notReady = new WizVaultPlayer(createTestPlayer())
    const ready = new WizVaultPlayer({ ...createTestPlayer(), exp: 100 })

    expect(notReady.canLevelUp()).toBe(false)
    expect(ready.canLevelUp()).toBe(true)
  })
})

describe("toPlain", () => {
  it("元のオブジェクトを返す", () => {
    const original = createTestPlayer()
    const player = new WizVaultPlayer(original)

    expect(player.toPlain()).toEqual(original)
  })
})

describe("メソッドチェーン", () => {
  it("複数の操作をチェーンできる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
    const updated = player.damage(10).addGold(50).addExp(25).useAp(1)

    expect(updated.hp).toBe(40)
    expect(updated.gold).toBe(150)
    expect(updated.exp).toBe(25)
    expect(updated.ap).toBe(4)
  })
})

describe("customAttributes", () => {
  it("未設定キーは undefined を返す", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.getCustomAttribute("luck")).toBeUndefined()
  })

  it("withCustomAttribute で値を設定できる", () => {
    const player = new WizVaultPlayer(createTestPlayer()).withCustomAttribute(
      "luck",
      7
    )

    expect(player.getCustomAttribute("luck")).toBe(7)
  })

  it("addCustomAttribute は未定義キーを 0 として扱う", () => {
    const player = new WizVaultPlayer(createTestPlayer()).addCustomAttribute(
      "perception",
      3
    )

    expect(player.getCustomAttribute("perception")).toBe(3)
  })

  it("addCustomAttribute は既存キーに加算する", () => {
    const player = new WizVaultPlayer(createTestPlayer())
      .withCustomAttribute("faith", 5)
      .addCustomAttribute("faith", 2)

    expect(player.getCustomAttribute("faith")).toBe(7)
  })

  it("customAttributes プロパティは未設定でも空オブジェクトを返す", () => {
    const player = new WizVaultPlayer(createTestPlayer())

    expect(player.customAttributes).toEqual({})
  })

  it("複数のカスタム属性を保持できる", () => {
    const player = new WizVaultPlayer(createTestPlayer())
      .withCustomAttribute("luck", 3)
      .withCustomAttribute("perception", 5)

    expect(player.customAttributes).toEqual({ luck: 3, perception: 5 })
  })
})

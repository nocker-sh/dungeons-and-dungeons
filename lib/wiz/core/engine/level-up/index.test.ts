import { describe, expect, it } from "vite-plus/test"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { DEFAULT_LEVEL_UP_CONFIG } from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import { WizPendingAttributes } from "@/lib/wiz/core/domain/values/pending-attributes"
import { WizEngineLevelUp } from "@/lib/wiz/core/engine/level-up"

const service = new WizEngineLevelUp()
const readyVault = MOCK_VAULT.updatePlayer((player) => player.addExp(player.expToNextLevel))

it("構築後のconfig変更から成長規則を所有分離する", () => {
  const config = {
    expFormula: (level: number) => level * 10,
    pointsPerLevelUp: 2,
    hpGainFormula: (vitalityBonus: number) => vitalityBonus + 4,
  }
  const ownedService = new WizEngineLevelUp(config)
  config.pointsPerLevelUp = 99
  config.expFormula = () => 999

  expect(ownedService.getPointsPerLevelUp()).toBe(2)
  expect(ownedService.getExpToNextLevel(3)).toBe(30)
})

describe("getExpToNextLevel", () => {
  it("レベルに応じた必要経験値を返す", () => {
    expect(service.getExpToNextLevel(1)).toBe(50)
    expect(service.getExpToNextLevel(2)).toBe(100)
    expect(service.getExpToNextLevel(10)).toBe(500)
  })
})

describe("getPointsPerLevelUp", () => {
  it("レベルアップ時のポイントを返す", () => {
    expect(service.getPointsPerLevelUp()).toBe(3)
  })
})

describe("prepareLevelUp", () => {
  it("表示文言を含まない能力値ポイント獲得ログを返す", () => {
    const result = service.prepareLevelUp(readyVault)
    const lastLog = result.vault.log[result.vault.log.length - 1]

    expect(result.pointsToAllocate).toBe(3)
    expect(lastLog).toEqual({
      key: "LEVEL_UP_POINTS_GRANTED",
      points: 3,
    })
  })

  it("必要経験値に達していない状態を拒否する", () => {
    expect(() => service.prepareLevelUp(MOCK_VAULT)).toThrow(
      "Level up is not available for the current vault",
    )
  })
})

describe("getHpGain", () => {
  it("体力ボーナスなしの場合の基本HP増加", () => {
    expect(service.getHpGain(0)).toBe(5)
  })

  it("体力ボーナスありの場合のHP増加", () => {
    expect(service.getHpGain(1)).toBe(7) // 5 + 1*2
    expect(service.getHpGain(3)).toBe(11) // 5 + 3*2
  })
})

describe("applyLevelUp", () => {
  it("レベルが上がる", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addExp(p.expToNextLevel))
    const pendingAttributes = WizPendingAttributes.fromPlain({})

    const newVault = service.applyLevelUp(vault, pendingAttributes)

    expect(newVault.player.level).toBe(vault.player.level + 1)
  })

  it("必要経験値に達していない状態を拒否する", () => {
    const pendingAttributes = WizPendingAttributes.fromPlain({})

    expect(() => service.applyLevelUp(MOCK_VAULT, pendingAttributes)).toThrow(
      "Level up is not available for the current vault",
    )
  })

  it("必要経験値を超えた分を次のレベルへ引き継ぐ", () => {
    const excessExp = 12
    const vault = MOCK_VAULT.updatePlayer((player) =>
      player.addExp(player.expToNextLevel + excessExp),
    )
    const pendingAttributes = WizPendingAttributes.fromPlain({})

    const newVault = service.applyLevelUp(vault, pendingAttributes)

    expect(newVault.player.exp).toBe(excessExp)
  })

  it("最大HPが増加する", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addExp(p.expToNextLevel))
    const pendingAttributes = WizPendingAttributes.fromPlain({})
    const initialMaxHp = vault.player.maxHp

    const newVault = service.applyLevelUp(vault, pendingAttributes)

    expect(newVault.player.maxHp).toBe(initialMaxHp + 5)
  })

  it("体力に振るとHP増加量が増える", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addExp(p.expToNextLevel))
    const pendingAttributes = WizPendingAttributes.fromPlain({
      vitality: 2,
    })
    const initialMaxHp = vault.player.maxHp

    const newVault = service.applyLevelUp(vault, pendingAttributes)

    expect(newVault.player.maxHp).toBe(initialMaxHp + 9) // 5 + 2*2
  })

  it("ステータスが上がる", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addExp(p.expToNextLevel))
    const initialStr = vault.player.attributes.strength
    const pendingAttributes = WizPendingAttributes.fromPlain({
      strength: 2,
      dexterity: 1,
    })

    const newVault = service.applyLevelUp(vault, pendingAttributes)

    expect(newVault.player.attributes.strength).toBe(initialStr + 2)
  })

  it("次のレベルまでの必要経験値が更新される", () => {
    const vault = MOCK_VAULT.updatePlayer((p) => p.addExp(p.expToNextLevel))
    const pendingAttributes = WizPendingAttributes.fromPlain({})

    const newVault = service.applyLevelUp(vault, pendingAttributes)
    const newLevel = newVault.player.level

    expect(newVault.player.expToNextLevel).toBe(newLevel * 50)
  })
})

describe("カスタム設定", () => {
  it("カスタム経験値計算式を使用できる", () => {
    const customService = new WizEngineLevelUp({
      ...DEFAULT_LEVEL_UP_CONFIG,
      expFormula: (level) => level * level * 50,
    })

    expect(customService.getExpToNextLevel(1)).toBe(50)
    expect(customService.getExpToNextLevel(5)).toBe(1250)
  })

  it("カスタムポイント数を使用できる", () => {
    const customService = new WizEngineLevelUp({
      ...DEFAULT_LEVEL_UP_CONFIG,
      pointsPerLevelUp: 5,
    })

    expect(customService.getPointsPerLevelUp()).toBe(5)
  })
})

describe("WizPendingAttributes", () => {
  describe("empty", () => {
    it("空の振り分けを作成できる", () => {
      const pending = WizPendingAttributes.fromPlain({})

      expect(pending.total).toBe(0)
      expect(pending.get("strength")).toBe(0)
    })
  })

  describe("allocate", () => {
    it("ステータスにポイントを振れる", () => {
      const pending = WizPendingAttributes.fromPlain({}).allocate("strength")

      expect(pending.get("strength")).toBe(1)
      expect(pending.total).toBe(1)
    })

    it("複数回振れる", () => {
      const pending = WizPendingAttributes.fromPlain({})
        .allocate("strength")
        .allocate("strength")
        .allocate("dexterity")

      expect(pending.get("strength")).toBe(2)
      expect(pending.get("dexterity")).toBe(1)
      expect(pending.total).toBe(3)
    })
  })

  describe("reset", () => {
    it("振り分けをリセットできる", () => {
      const pending = WizPendingAttributes.fromPlain({})
        .allocate("strength")
        .allocate("dexterity")
        .reset()

      expect(pending.total).toBe(0)
    })
  })

  describe("vitalityBonus", () => {
    it("体力への振り分け量を返す", () => {
      const pending = WizPendingAttributes.fromPlain({
        vitality: 3,
      })

      expect(pending.vitalityBonus).toBe(3)
    })

    it("体力に振っていない場合は0", () => {
      const pending = WizPendingAttributes.fromPlain({
        strength: 2,
      })

      expect(pending.vitalityBonus).toBe(0)
    })
  })

  describe("entries", () => {
    it("振り分けたステータスのエントリを返す", () => {
      const pending = WizPendingAttributes.fromPlain({
        strength: 2,
        dexterity: 1,
      })
      const entries = pending.entries()

      expect(entries).toContainEqual(["strength", 2])
      expect(entries).toContainEqual(["dexterity", 1])
      expect(entries).toHaveLength(2)
    })

    it("0のステータスは含まない", () => {
      const pending = WizPendingAttributes.fromPlain({
        strength: 0,
        dexterity: 1,
      })
      const entries = pending.entries()

      expect(entries).toHaveLength(1)
      expect(entries[0][0]).toBe("dexterity")
    })
  })

  describe("toPlain / fromPlain", () => {
    it("プレーンオブジェクトとの相互変換", () => {
      const stats = { strength: 2, vitality: 1 }
      const pending = WizPendingAttributes.fromPlain(stats)
      const plain = pending.toPlain()

      expect(plain.strength).toBe(2)
      expect(plain.vitality).toBe(1)
    })
  })
})

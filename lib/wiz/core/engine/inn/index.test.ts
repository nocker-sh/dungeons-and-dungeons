import { describe, expect, it } from "vite-plus/test"
import { WizEngineInn } from "@/lib/wiz/core/engine/inn"
import { WizEngineInnPlanCatalog } from "@/lib/wiz/core/engine/inn/plan-catalog"
import type { WizEngineTimeFactory } from "@/lib/wiz/core/engine/time/wiz-time-factory"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"

const plans = new WizEngineInnPlanCatalog([
  {
    id: "rest",
    price: 20,
    hpRecovery: { fixed: 30 },
    mpRecovery: { fixed: 8 },
    hungerRecovery: 25,
    apRecovery: 2,
  },
  {
    id: "complete",
    price: 50,
    hpRecovery: { percent: 100 },
    mpRecovery: { percent: 100 },
    hungerRecovery: 100,
    apRecovery: "full",
  },
])
const service = new WizEngineInn(plans)

describe("WizEngineInnPlanCatalog", () => {
  it("入力を所有したimmutable catalogを作る", () => {
    const input = [
      {
        id: "mutable",
        price: 10,
        hpRecovery: { fixed: 5 },
      },
    ]
    const catalog = new WizEngineInnPlanCatalog(input)

    input[0]!.price = 999
    input[0]!.hpRecovery.fixed = 999
    input.push({ id: "added", price: 1, hpRecovery: { fixed: 1 } })

    expect(catalog.get("mutable")).toEqual({
      id: "mutable",
      price: 10,
      hpRecovery: { fixed: 5 },
    })
    expect(catalog.get("added")).toBeUndefined()
    expect(Object.isFrozen(catalog.plans)).toBe(true)
    expect(Object.isFrozen(catalog.get("mutable"))).toBe(true)
  })

  it("重複IDを拒否する", () => {
    expect(
      () =>
        new WizEngineInnPlanCatalog([
          { id: "same", price: 10 },
          { id: "same", price: 20 },
        ])
    ).toThrow(WizValueValidationError)
  })

  it("不正な回復値を境界で拒否する", () => {
    expect(
      () =>
        new WizEngineInnPlanCatalog([
          { id: "invalid", price: 10, hpRecovery: { percent: 101 } },
        ])
    ).toThrow(WizValueValidationError)
  })
})

describe("canAffordStay", () => {
  it("所持金が足りる場合はtrueを返す", () => {
    expect(service.canAffordStay(MOCK_VAULT, "rest")).toBe(true)
  })

  it("所持金が足りない場合はfalseを返す", () => {
    const vault = MOCK_VAULT.updatePlayer((player) =>
      player.spendGold(player.gold)
    )
    expect(service.canAffordStay(vault, "rest")).toBe(false)
  })

  it("catalogにないIDはfalseを返す", () => {
    expect(service.canAffordStay(MOCK_VAULT, "missing")).toBe(false)
  })
})

describe("stay", () => {
  it("定義されたlocal resourceを上限まで回復して料金を支払う", () => {
    const vault = MOCK_VAULT.updatePlayer((player) =>
      player.damage(40).withMp(5).withHunger(30).useAp(3)
    )

    const result = service.stay(vault, "rest")

    expect(result.status).toBe("completed")
    expect(result.success).toBe(true)
    expect(result.hpRecovered).toBe(30)
    expect(result.mpRecovered).toBe(8)
    expect(result.hungerRecovered).toBe(25)
    expect(result.apRecovered).toBe(2)
    expect(result.vault.player.hp).toBe(vault.player.hp + 30)
    expect(result.vault.player.mp).toBe(vault.player.mp + 8)
    expect(result.vault.player.hunger).toBe(vault.player.hunger + 25)
    expect(result.vault.player.ap).toBe(vault.player.ap + 2)
    expect(result.vault.player.gold).toBe(vault.player.gold - 20)
  })

  it("割合回復と全AP回復を上限で切り詰める", () => {
    const vault = MOCK_VAULT.updatePlayer((player) =>
      player.damage(10).withMp(1).withHunger(90).useAp(4)
    )

    const result = service.stay(vault, "complete")

    expect(result.status).toBe("completed")
    expect(result.hpRecovered).toBe(10)
    expect(result.mpRecovered).toBe(vault.player.maxMp - vault.player.mp)
    expect(result.hungerRecovered).toBe(10)
    expect(result.apRecovered).toBe(4)
    expect(result.vault.player.hp).toBe(result.vault.player.maxHp)
    expect(result.vault.player.mp).toBe(result.vault.player.maxMp)
    expect(result.vault.player.hunger).toBe(100)
    expect(result.vault.player.ap).toBe(result.vault.player.maxAp)
  })

  it("party memberのHPとMPにも同じ回復定義を適用する", () => {
    const vault = MOCK_VAULT.withPartyMembers(
      MOCK_VAULT.partyMembers.map((member) => ({
        ...member,
        hp: 0,
        mp: 0,
      }))
    )

    const result = service.stay(vault, "rest")

    expect(result.vault.partyMembers[0]?.hp).toBe(30)
    expect(result.vault.partyMembers[0]?.mp).toBe(8)
  })

  it("翌朝へ進めて履歴を残す", () => {
    const result = service.stay(MOCK_VAULT, "rest")

    expect(result.vault.time.day).toBe(MOCK_VAULT.time.day + 1)
    expect(result.vault.time.timeOfDay).toBe("morning")
    expect(
      result.vault.log.some(
        (log) => log.key === "INN_RESTED" && log.planId === "rest"
      )
    ).toBe(true)
  })

  it("資金不足を理由付きで拒否する", () => {
    const vault = MOCK_VAULT.updatePlayer((player) =>
      player.spendGold(player.gold)
    )
    const result = service.stay(vault, "complete")

    expect(result.status).toBe("rejected")
    if (result.status === "rejected") {
      expect(result.rejection).toEqual({
        type: "insufficient_gold",
        planId: "complete",
        required: 50,
        available: 0,
        shortfall: 50,
      })
    }
    expect(result.hpRecovered).toBe(0)
    expect(result.mpRecovered).toBe(0)
    expect(result.hungerRecovered).toBe(0)
    expect(result.apRecovered).toBe(0)
    expect(result.goldSpent).toBe(0)
  })

  it("存在しないプランをvaultを変更せず拒否する", () => {
    const result = service.stay(MOCK_VAULT, "missing")

    expect(result.status).toBe("rejected")
    if (result.status === "rejected") {
      expect(result.rejection).toEqual({
        type: "unknown_plan",
        planId: "missing",
      })
    }
    expect(result.vault).toBe(MOCK_VAULT)
  })
})

describe("DI", () => {
  it("カスタム timeFactory で宿泊後の天候を決定できる", () => {
    const timeFactory = {
      rollWeather: () => "stormy" as const,
    } as unknown as WizEngineTimeFactory
    const configuredService = new WizEngineInn(plans, { timeFactory })

    const result = configuredService.stay(MOCK_VAULT, "rest")

    expect(result.status).toBe("completed")
    expect(result.vault.time.weather).toBe("stormy")
  })
})

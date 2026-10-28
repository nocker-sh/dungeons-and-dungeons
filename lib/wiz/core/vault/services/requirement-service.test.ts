import { describe, expect, it } from "vite-plus/test"
import type { WizRequirementContext, WizRequirements } from "@/lib/wiz/core/types"
import { WizVaultRequirementService } from "@/lib/wiz/core/vault/services/requirement-service"

const service = new WizVaultRequirementService()
const inventoryWith = (quantities: Readonly<Record<string, number>>) =>
  Object.freeze({
    totalQuantity: (_contentType: "item", contentId: string) => quantities[contentId] ?? 0,
  })

describe("meetsRequirements (レベル)", () => {
  it("最低レベル以上で満たす", () => {
    const requirements: WizRequirements = { minLevel: 5 }
    const context: WizRequirementContext = { level: 10 }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("最低レベル未満で満たさない", () => {
    const requirements: WizRequirements = { minLevel: 10 }
    const context: WizRequirementContext = { level: 5 }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })

  it("最高レベル以下で満たす", () => {
    const requirements: WizRequirements = { maxLevel: 20 }
    const context: WizRequirementContext = { level: 15 }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("最高レベル超過で満たさない", () => {
    const requirements: WizRequirements = { maxLevel: 10 }
    const context: WizRequirementContext = { level: 15 }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })

  it("レベル範囲内で満たす", () => {
    const requirements: WizRequirements = { minLevel: 5, maxLevel: 15 }
    const context: WizRequirementContext = { level: 10 }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })
})

describe("meetsRequirements (フラグ)", () => {
  it("必須フラグを持っていれば満たす", () => {
    const requirements: WizRequirements = { requiredFlags: ["quest_complete"] }
    const context: WizRequirementContext = {
      flags: ["quest_complete", "other"],
    }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("必須フラグがなければ満たさない", () => {
    const requirements: WizRequirements = { requiredFlags: ["quest_complete"] }
    const context: WizRequirementContext = { flags: ["other"] }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })

  it("複数の必須フラグが全て必要", () => {
    const requirements: WizRequirements = {
      requiredFlags: ["flag1", "flag2"],
    }
    const context: WizRequirementContext = { flags: ["flag1"] }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })

  it("禁止フラグがなければ満たす", () => {
    const requirements: WizRequirements = { forbiddenFlags: ["banned"] }
    const context: WizRequirementContext = { flags: ["other"] }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("禁止フラグがあれば満たさない", () => {
    const requirements: WizRequirements = { forbiddenFlags: ["banned"] }
    const context: WizRequirementContext = { flags: ["banned", "other"] }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })
})

describe("meetsRequirements (アイテム)", () => {
  it("必要なアイテムを持っていれば満たす", () => {
    const requirements: WizRequirements = {
      requiredItems: [{ itemId: "key", quantity: 1 }],
    }
    const context: WizRequirementContext = {
      inventory: inventoryWith({ key: 5 }),
    }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("アイテムの数が不足すると満たさない", () => {
    const requirements: WizRequirements = {
      requiredItems: [{ itemId: "key", quantity: 3 }],
    }
    const context: WizRequirementContext = {
      inventory: inventoryWith({ key: 2 }),
    }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })

  it("アイテムがなければ満たさない", () => {
    const requirements: WizRequirements = {
      requiredItems: [{ itemId: "key", quantity: 1 }],
    }
    const context: WizRequirementContext = {
      inventory: inventoryWith({ other: 10 }),
    }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })
})

describe("meetsRequirements (好感度)", () => {
  it("最低好感度以上で満たす", () => {
    const requirements: WizRequirements = { minAffinity: 50 }
    const context: WizRequirementContext = { affinity: 75 }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("最低好感度未満で満たさない", () => {
    const requirements: WizRequirements = { minAffinity: 50 }
    const context: WizRequirementContext = { affinity: 30 }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })

  it("最高好感度以下で満たす", () => {
    const requirements: WizRequirements = { maxAffinity: 100 }
    const context: WizRequirementContext = { affinity: 80 }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("最高好感度超過で満たさない", () => {
    const requirements: WizRequirements = { maxAffinity: 50 }
    const context: WizRequirementContext = { affinity: 80 }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })
})

describe("meetsRequirements (複合条件)", () => {
  it("全ての条件を満たせば通る", () => {
    const requirements: WizRequirements = {
      minLevel: 5,
      requiredFlags: ["quest_complete"],
      requiredItems: [{ itemId: "key", quantity: 1 }],
    }
    const context: WizRequirementContext = {
      level: 10,
      flags: ["quest_complete"],
      inventory: inventoryWith({ key: 2 }),
    }

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })

  it("一つでも条件を満たさないと通らない", () => {
    const requirements: WizRequirements = {
      minLevel: 5,
      requiredFlags: ["quest_complete"],
    }
    const context: WizRequirementContext = {
      level: 10,
      flags: [], // フラグなし
    }

    expect(service.meetsRequirements(requirements, context)).toBe(false)
  })
})

describe("meetsRequirements (空の条件)", () => {
  it("条件がなければ常に満たす", () => {
    const requirements: WizRequirements = {}
    const context: WizRequirementContext = {}

    expect(service.meetsRequirements(requirements, context)).toBe(true)
  })
})

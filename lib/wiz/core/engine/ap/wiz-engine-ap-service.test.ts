import { describe, expect, test } from "vite-plus/test"
import { WizEngineApService } from "@/lib/wiz/core/engine/ap/wiz-engine-ap-service"

describe("WizEngineApService", () => {
  const service = new WizEngineApService()

  describe("getEffectiveMaxAp", () => {
    test("ペナルティ0なら maxAp そのまま", () => {
      expect(service.getEffectiveMaxAp(5, 0)).toBe(5)
    })

    test("ペナルティ分だけ maxAp が減る", () => {
      expect(service.getEffectiveMaxAp(5, 2)).toBe(3)
    })

    test("最低値は1", () => {
      expect(service.getEffectiveMaxAp(5, 10)).toBe(1)
    })
  })

  describe("canAct", () => {
    test("AP 1以上なら行動可能", () => {
      expect(service.canAct(1)).toBe(true)
    })

    test("AP 0なら行動不可", () => {
      expect(service.canAct(0)).toBe(false)
    })
  })
})

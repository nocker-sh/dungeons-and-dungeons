import { describe, expect, it } from "vite-plus/test"
import { statusResistanceView } from "./names"

describe("状態異常の完全耐性を区別する", () => {
  it("実際に100%なら無効と案内する", () => {
    expect(statusResistanceView("poison", 1)).toMatchObject({
      immune: true,
      label: "毒無効",
    })
    expect(statusResistanceView("bind", 0.7)).toMatchObject({
      immune: false,
      label: "縛り70%",
    })
  })
  it("丸めて100%になっても完全無効と案内しない", () => {
    expect(statusResistanceView("poison", 0.999)).toMatchObject({
      immune: false,
      label: "毒100%未満",
    })
  })
})

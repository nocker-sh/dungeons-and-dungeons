import { describe, expect, it } from "vite-plus/test"
import { WizVaultFlagService } from "@/lib/wiz/core/vault/services/flag-service"

const service = new WizVaultFlagService()

describe("addFlag", () => {
  it("フラグを追加できる", () => {
    const flags = Object.freeze(["flag1"])

    const result = service.addFlag(flags, "flag2")

    expect(result).toContain("flag1")
    expect(result).toContain("flag2")
  })

  it("空の配列にフラグを追加できる", () => {
    const flags: readonly string[] = Object.freeze([])

    const result = service.addFlag(flags, "flag1")

    expect(result).toContain("flag1")
  })

  it("既存のフラグを追加しようとしても重複しない", () => {
    const flags = Object.freeze(["flag1", "flag2"])

    const result = service.addFlag(flags, "flag1")

    expect(result).toHaveLength(2)
  })

  it("元の配列は変更されない", () => {
    const flags = Object.freeze(["flag1"])

    service.addFlag(flags, "flag2")

    expect(flags).toHaveLength(1)
  })
})

describe("removeFlag", () => {
  it("フラグを削除できる", () => {
    const flags = Object.freeze(["flag1", "flag2"])

    const result = service.removeFlag(flags, "flag1")

    expect(result).not.toContain("flag1")
    expect(result).toContain("flag2")
  })

  it("存在しないフラグを削除しても問題ない", () => {
    const flags = Object.freeze(["flag1"])

    const result = service.removeFlag(flags, "flag2")

    expect(result).toHaveLength(1)
    expect(result).toContain("flag1")
  })

  it("元の配列は変更されない", () => {
    const flags = Object.freeze(["flag1", "flag2"])

    service.removeFlag(flags, "flag1")

    expect(flags).toHaveLength(2)
  })
})

describe("hasFlag", () => {
  it("フラグが存在する場合はtrueを返す", () => {
    const flags = Object.freeze(["flag1", "flag2"])

    expect(service.hasFlag(flags, "flag1")).toBe(true)
  })

  it("フラグが存在しない場合はfalseを返す", () => {
    const flags = Object.freeze(["flag1"])

    expect(service.hasFlag(flags, "flag2")).toBe(false)
  })

  it("空の配列はfalseを返す", () => {
    const flags: readonly string[] = Object.freeze([])

    expect(service.hasFlag(flags, "flag1")).toBe(false)
  })
})

describe("hasAllFlags", () => {
  it("全てのフラグが存在する場合はtrueを返す", () => {
    const flags = Object.freeze(["flag1", "flag2", "flag3"])
    const required = Object.freeze(["flag1", "flag2"])

    expect(service.hasAllFlags(flags, required)).toBe(true)
  })

  it("一部のフラグが存在しない場合はfalseを返す", () => {
    const flags = Object.freeze(["flag1"])
    const required = Object.freeze(["flag1", "flag2"])

    expect(service.hasAllFlags(flags, required)).toBe(false)
  })

  it("必須フラグが空の場合はtrueを返す", () => {
    const flags = Object.freeze(["flag1"])
    const required: readonly string[] = Object.freeze([])

    expect(service.hasAllFlags(flags, required)).toBe(true)
  })

  it("両方空の場合はtrueを返す", () => {
    const flags: readonly string[] = Object.freeze([])
    const required: readonly string[] = Object.freeze([])

    expect(service.hasAllFlags(flags, required)).toBe(true)
  })
})

import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { runCli } from "@/builder/cli/main"

const handlers = vi.hoisted(() => ({
  play: vi.fn(),
  battle: vi.fn(),
  report: vi.fn(),
}))
vi.mock("@/builder/cli/command-play", () => ({ commandPlay: handlers.play }))
vi.mock("@/builder/cli/command-ai", () => ({ commandAi: vi.fn() }))
vi.mock("@/builder/cli/command-battle", () => ({
  commandBattle: handlers.battle,
}))
vi.mock("@/builder/cli/command-curve", () => ({ commandCurve: vi.fn() }))
vi.mock("@/builder/cli/command-report", () => ({
  commandReport: handlers.report,
}))
vi.mock("@/builder/cli/command-sweep", () => ({ commandSweep: vi.fn() }))

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe("CLIの入口", () => {
  it.each([
    ["battle", "--runs", "banana"],
    ["report", "--runs", "0"],
    ["play", "--seed", "NaN"],
    ["report", "--seeds", "1,wrong,7"],
    ["battle", "--style", "attak"],
    ["play", "--style", "--json"],
  ])("不正な指定では処理を開始しない: %s %s %s", async (...args) => {
    const previous = process.exitCode
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      await runCli(args)
      expect(process.exitCode).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining(args[1]))
      expect(handlers.battle).not.toHaveBeenCalled()
      expect(handlers.report).not.toHaveBeenCalled()
      expect(handlers.play).not.toHaveBeenCalled()
    } finally {
      process.exitCode = previous
    }
  })

  it("一歩ずつ遊ぶ操作はコマンド名と引用された一行をそのまま渡す", async () => {
    await runCli(["play", "depart layer0", "--seed", "7"])
    expect(handlers.play).toHaveBeenCalledWith(
      expect.objectContaining({
        positional: ["play", "depart layer0"],
        seed: 7,
      })
    )
  })

  it("戦闘は敵の指定を先頭へ移し、上書きと測定回数を渡す", async () => {
    await runCli([
      "battle",
      "hiyokobu",
      "--runs",
      "3",
      "--set",
      "foes.hiyokobu.hp=10",
    ])
    expect(handlers.battle).toHaveBeenCalledWith(
      expect.objectContaining({
        positional: ["hiyokobu"],
        runs: 3,
        overrides: ["foes.hiyokobu.hp=10"],
      })
    )
  })

  it("不足した引数はスタックトレースではなく、終了コードと理由を返す", async () => {
    const previous = process.exitCode
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      await runCli(["battle", "--runs"])
      expect(process.exitCode).toBe(1)
      expect(error).toHaveBeenCalledWith("エラー: --runs の値がない")
    } finally {
      process.exitCode = previous
    }
  })

  it("測定の非同期エラーも入口で受け取り、checkは厳密な合否を指定する", async () => {
    const previous = process.exitCode
    handlers.report.mockRejectedValueOnce(new Error("測定に失敗"))
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      await runCli(["check"])
      expect(handlers.report).toHaveBeenCalledWith(expect.anything(), true)
      expect(process.exitCode).toBe(1)
      expect(error).toHaveBeenCalledWith("エラー: 測定に失敗")
    } finally {
      process.exitCode = previous
    }
  })
})

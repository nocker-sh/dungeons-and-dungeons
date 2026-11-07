import { afterEach, expect, test, vi } from "vite-plus/test"
import * as fs from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { commandPlay } from "@/builder/cli/command-play"
import { parseOptions } from "@/builder/cli/options"

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>()
  return {
    ...actual,
    writeFileSync: vi.fn(actual.writeFileSync),
    renameSync: vi.fn(actual.renameSync),
  }
})
const actualFs = await vi.importActual<typeof import("node:fs")>("node:fs")
const folders: string[] = []
afterEach(() => {
  vi.mocked(fs.writeFileSync).mockImplementation(actualFs.writeFileSync)
  vi.mocked(fs.renameSync).mockImplementation(actualFs.renameSync)
  vi.restoreAllMocks()
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true })
})

for (const existing of [false, true])
  for (const failure of ["partial-write", "replace"])
    test(`${failure} preserves ${existing ? "the previous save" : "an absent save"} and a retry commits the real action once`, () => {
      const folder = fs.mkdtempSync(join(tmpdir(), "dnd-cli-save-failure-"))
      folders.push(folder)
      const file = join(folder, "save.json")
      const expected = join(folder, "expected.json")
      const output = vi.spyOn(console, "log").mockImplementation(() => {})
      const play = (path: string, ...commands: string[]) => {
        commandPlay(
          parseOptions([
            "play",
            "--json",
            "--seed",
            "42",
            "--save",
            path,
            ...commands,
          ])
        )
        const result = JSON.parse(output.mock.calls.at(-1)![0] as string)
        expect(result.log.join("\n")).not.toMatch(/拒否:|エラー:/)
      }
      if (existing) {
        play(file, "buy armory sword")
        fs.copyFileSync(file, expected)
      }
      const before = existing ? fs.readFileSync(file, "utf8") : undefined
      play(expected, "buy armory sword")
      const target = fs.readFileSync(expected, "utf8")
      const error = new Error("injected storage failure")
      if (failure === "partial-write")
        vi.mocked(fs.writeFileSync).mockImplementationOnce(
          (path, data, options) => {
            // 実際に途中まで書いてから失敗させる。ゲーム処理は差し替えない。
            if (typeof data !== "string") throw new Error("expected JSON text")
            actualFs.writeFileSync(path, data.slice(0, 20), options)
            throw error
          }
        )
      else
        vi.mocked(fs.renameSync).mockImplementationOnce(() => {
          throw error
        })
      expect(() => play(file, "buy armory sword")).toThrow(error)
      if (existing) expect(fs.readFileSync(file, "utf8")).toBe(before)
      else expect(fs.existsSync(file)).toBe(false)
      expect(fs.readdirSync(folder).sort()).toEqual(
        existing ? ["expected.json", "save.json"] : ["expected.json"]
      )
      play(file, "buy armory sword")
      expect(fs.readFileSync(file, "utf8")).toBe(target)
      play(file, "state")
      expect(fs.readFileSync(file, "utf8")).toBe(target)
    })

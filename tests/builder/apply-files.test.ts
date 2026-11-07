import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"
import { commandApply } from "@/builder/cli/apply"
import { parseOptions } from "@/builder/cli/options"
import { dataDirectory } from "@/content/data-directory"

let folder = ""
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {})
  folder = mkdtempSync(join(tmpdir(), "dnd-apply-files-"))
  cpSync(fileURLToPath(dataDirectory()), folder, { recursive: true })
})
afterEach(() => {
  if (folder) rmSync(folder, { recursive: true, force: true })
  vi.restoreAllMocks()
})
const texts = () =>
  new Map(
    readdirSync(folder)
      .filter((name) => name.endsWith(".json"))
      .map((name) => [name, readFileSync(join(folder, name), "utf8")])
  )

test("native writes update only requested numbers in an isolated copy of canonical JSON", () => {
  const original = readFileSync(
    new URL("settings.json", dataDirectory()),
    "utf8"
  )
  const before = texts()
  const files = readdirSync(folder)
  const foe = JSON.parse(before.get("foes.json")!)[0]
  commandApply(
    parseOptions([
      "apply",
      "--set",
      "balance.expBase+=2",
      "--set",
      `foes.${foe.slug}.hp+=3`,
    ]),
    pathToFileURL(folder + "/")
  )
  const after = texts()
  const expectedSettings = JSON.parse(before.get("settings.json")!)
  expectedSettings.balance.expBase += 2
  expect(JSON.parse(after.get("settings.json")!)).toEqual(expectedSettings)
  const expectedFoes = JSON.parse(before.get("foes.json")!)
  expectedFoes[0].hp += 3
  expect(JSON.parse(after.get("foes.json")!)).toEqual(expectedFoes)
  for (const [name, text] of before)
    if (name !== "settings.json" && name !== "foes.json")
      expect(after.get(name), name).toBe(text)
  expect(readdirSync(folder)).toEqual(files)
  expect(readFileSync(new URL("settings.json", dataDirectory()), "utf8")).toBe(
    original
  )
})

test("invalid canonical edits leave all native fixture files and names unchanged", () => {
  const before = texts()
  const files = readdirSync(folder)
  expect(() =>
    commandApply(
      parseOptions(["apply", "--set", "foes.*.hp=0"]),
      pathToFileURL(folder + "/")
    )
  ).toThrow()
  expect(texts()).toEqual(before)
  expect(readdirSync(folder)).toEqual(files)
})

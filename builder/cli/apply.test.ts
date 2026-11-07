import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test"
import { resolve, join } from "node:path"
import { pathToFileURL, fileURLToPath } from "node:url"
import { commandApply } from "@/builder/cli/apply"
import { parseOptions } from "@/builder/cli/options"

const io = vi.hoisted(() => ({
  files: new Map<string, string>(),
  writes: [] as string[],
  failBefore: new Set<number>(),
  failAfter: new Set<number>(),
  write: (_file: unknown, _text: unknown): void => {
    throw Error("No write adapter")
  },
}))
vi.mock("node:fs", async (original) => {
  const actual = await original<typeof import("node:fs")>()
  const url = await import("node:url")
  const key = (file: unknown) =>
    file instanceof URL ? file.href : url.pathToFileURL(String(file)).href
  return {
    ...actual,
    readFileSync: (file: unknown) => {
      const text = io.files.get(key(file))
      if (text === undefined) throw Error(`ENOENT: ${key(file)}`)
      return text
    },
    writeFileSync: (file: unknown, text: unknown) => io.write(file, text),
  }
})
vi.mock("@/lib/files/replace-text-file", () => ({
  replaceTextFile: (file: string, text: string) => io.write(file, text),
}))
const actual = await vi.importActual<typeof import("node:fs")>("node:fs")
const root = resolve(import.meta.dirname, "../..")
const directory = [
  join(root, "apps/main/content/data"),
  join(root, "content/data"),
].find((candidate) => actual.existsSync(join(candidate, "settings.json")))!
if (!directory) throw Error("No canonical content directory")

afterEach(() => vi.restoreAllMocks())
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {})
  io.failBefore.clear()
  io.failAfter.clear()
  io.write = (file, text) => {
    const target =
      file instanceof URL ? file.href : pathToFileURL(String(file)).href
    if (!io.files.has(target)) throw Error(`Unexpected data target: ${target}`)
    const attempt = io.writes.push(target)
    if (io.failBefore.has(attempt)) throw Error(`Write failed ${attempt}`)
    io.files.set(target, String(text))
    if (io.failAfter.has(attempt)) throw Error(`Write reply failed ${attempt}`)
  }
  io.files.clear()
  io.writes.length = 0
  for (const file of actual
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json")))
    io.files.set(
      pathToFileURL(join(directory, file)).href,
      actual.readFileSync(join(directory, file), "utf8")
    )
})

test("the real apply entry updates the canonical data directory without touching other files", () => {
  const before = new Map(io.files)
  const settings = pathToFileURL(join(directory, "settings.json")).href
  const initial = JSON.parse(before.get(settings)!)
  commandApply(parseOptions(["apply", "--set", "balance.expBase+=2"]))
  expect(JSON.parse(io.files.get(settings)!).balance.expBase).toBe(
    initial.balance.expBase + 2
  )
  expect(io.writes).toEqual([settings])
  for (const [file, text] of before)
    if (file !== settings)
      expect(io.files.get(file), fileURLToPath(file)).toBe(text)
})

test.each([
  "foes.*.hp=0",
  "balance.expBase=1e309",
  'foes.*.drops=[{"good":"unknown","count":1}]',
])(
  "%s is rejected by the real game-data validation before any file changes",
  (expression) => {
    const before = new Map(io.files)
    expect(() =>
      commandApply(parseOptions(["apply", "--set", expression]))
    ).toThrow()
    expect(io.writes).toEqual([])
    expect(io.files).toEqual(before)
  }
)

test("validates the freshly read files rather than the imported startup snapshot", () => {
  const file = pathToFileURL(join(directory, "foes.json")).href
  const broken = JSON.parse(io.files.get(file)!)
  broken[0].hp = 0
  io.files.set(file, JSON.stringify(broken))
  const before = new Map(io.files)
  expect(() =>
    commandApply(parseOptions(["apply", "--set", "balance.expBase+=2"]))
  ).toThrow()
  expect(io.writes).toEqual([])
  expect(io.files).toEqual(before)
})

test.each(["before", "after"] as const)(
  "restores exact previous text when a later write fails %s replacement",
  (phase) => {
    const before = new Map(io.files)
    if (phase === "before") io.failBefore.add(2)
    else io.failAfter.add(2)
    expect(() =>
      commandApply(
        parseOptions([
          "apply",
          "--set",
          "balance.expBase+=2",
          "--set",
          "foes.*.hp+=1",
        ])
      )
    ).toThrow()
    expect(io.writes.length).toBeGreaterThan(2)
    expect(io.files).toEqual(before)
    expect(console.log).not.toHaveBeenCalled()
  }
)

test("retains the write and restoration errors while attempting the remaining restores", () => {
  const before = new Map(io.files)
  io.failAfter.add(2)
  io.failBefore.add(3)
  let failure: unknown
  try {
    commandApply(
      parseOptions([
        "apply",
        "--set",
        "balance.expBase+=2",
        "--set",
        "foes.*.hp+=1",
      ])
    )
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(AggregateError)
  expect(
    (failure as AggregateError).errors.map((error: Error) => error.message)
  ).toEqual(["Write reply failed 2", "Write failed 3"])
  const foes = pathToFileURL(join(directory, "foes.json")).href
  expect(io.files.get(foes)).toBe(before.get(foes))
  expect(io.writes).toHaveLength(4)
  expect(console.log).not.toHaveBeenCalled()
})

test("an injected directory URL needs no trailing slash and remains caller-owned", () => {
  const supplied = pathToFileURL(directory)
  const before = supplied.href
  commandApply(parseOptions(["apply", "--set", "balance.expBase+=2"]), supplied)
  expect(supplied.href).toBe(before)
  expect(io.writes).toEqual([
    pathToFileURL(join(directory, "settings.json")).href,
  ])
})

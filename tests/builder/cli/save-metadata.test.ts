import { afterEach, expect, test, vi } from "vite-plus/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { commandPlay } from "@/builder/cli/command-play"
import { parseOptions } from "@/builder/cli/options"
import { SeededRandom } from "@/builder/lib/random"

const folders: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true })
})

const corruptions = [
  {
    field: "seed",
    values: [null, false, "42", 0.5, Number.MAX_SAFE_INTEGER + 1, {}, []],
  },
  { field: "rng", values: [null, false, "42", -1, 0.5, 0x100000000, {}, []] },
  {
    field: "serial",
    values: [null, false, "42", -1, 0.5, Number.MAX_SAFE_INTEGER + 1, {}, []],
  },
]

for (const { field, values } of corruptions)
  for (const value of values)
    for (const command of ["state", "buy armory sword"])
      test(`rejects ${field}=${JSON.stringify(value)} before ${command} or saving`, () => {
        const folder = mkdtempSync(join(tmpdir(), "dnd-save-metadata-"))
        folders.push(folder)
        const file = join(folder, "save.json")
        const output = vi.spyOn(console, "log").mockImplementation(() => {})
        commandPlay(
          parseOptions([
            "play",
            "--json",
            "--new",
            "--seed",
            "42",
            "--save",
            file,
            "buy armory sword",
          ])
        )
        const saved = JSON.parse(readFileSync(file, "utf8"))
        saved[field] = value
        const before = JSON.stringify(saved)
        writeFileSync(file, before)
        output.mockClear()
        let error: unknown
        try {
          commandPlay(parseOptions(["play", "--json", "--save", file, command]))
        } catch (caught) {
          error = caught
        }
        expect({
          rejected: error instanceof Error,
          unchanged: readFileSync(file, "utf8") === before,
          reported: output.mock.calls.length,
        }).toEqual({ rejected: true, unchanged: true, reported: 0 })
      })

for (const seed of [0, -7, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER])
  test(`keeps the CLI's supported integer seed ${seed} when reopening`, () => {
    const folder = mkdtempSync(join(tmpdir(), "dnd-save-seed-boundary-"))
    folders.push(folder)
    const file = join(folder, "save.json")
    vi.spyOn(console, "log").mockImplementation(() => {})
    commandPlay(
      parseOptions([
        "play",
        "--json",
        "--new",
        "--seed",
        String(seed),
        "--save",
        file,
        "buy armory sword",
      ])
    )
    const before = readFileSync(file, "utf8")
    commandPlay(parseOptions(["play", "--json", "--save", file, "state"]))
    expect(readFileSync(file, "utf8")).toBe(before)
  })

test("a browser save without CLI metadata resumes with the established defaults", () => {
  const folder = mkdtempSync(join(tmpdir(), "dnd-browser-save-metadata-"))
  folders.push(folder)
  const file = join(folder, "save.json")
  const expected = join(folder, "expected.json")
  const output = vi.spyOn(console, "log").mockImplementation(() => {})
  commandPlay(
    parseOptions([
      "play",
      "--json",
      "--new",
      "--save",
      file,
      "buy armory sword",
    ])
  )
  const save = JSON.parse(readFileSync(file, "utf8")).save
  writeFileSync(file, JSON.stringify({ save }))
  writeFileSync(
    expected,
    JSON.stringify({
      seed: 7,
      rng: new SeededRandom(7).state,
      serial: 1000,
      save,
    })
  )
  for (const path of [file, expected]) {
    commandPlay(
      parseOptions([
        "play",
        "--json",
        "--seed",
        "7",
        "--save",
        path,
        "buy armory sword",
      ])
    )
    expect(
      JSON.parse(output.mock.calls.at(-1)![0] as string).log.join("\n")
    ).not.toMatch(/拒否:|エラー:/)
  }
  expect(readFileSync(file, "utf8")).toBe(readFileSync(expected, "utf8"))
})

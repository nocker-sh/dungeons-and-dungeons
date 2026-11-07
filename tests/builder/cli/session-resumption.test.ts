import { afterEach, expect, test, vi } from "vite-plus/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { commandPlay } from "@/builder/cli/command-play"
import { parseOptions } from "@/builder/cli/options"
import { realContent } from "@/lib/wiz/testing/real-content"

const folders: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true })
})

for (const recruit of realContent().recruits.filter(
  (entry) => !!entry.member.weapon
))
  for (const seed of [1, 42])
    test(`${recruit.member.id}: split CLI calls retain the same JSON result as one call, seed=${seed}`, () => {
      const folder = mkdtempSync(join(tmpdir(), "dnd-cli-random-resumption-"))
      folders.push(folder)
      const saved = join(folder, "split.json")
      const whole = join(folder, "whole.json")
      const output = vi.spyOn(console, "log").mockImplementation(() => {})
      const options = [
        "play",
        "--json",
        "--seed",
        String(seed),
        "--set",
        `startingCompanions=${JSON.stringify([recruit.member.id])}`,
      ]
      commandPlay(
        parseOptions([...options, "--new", "--save", saved, "buy armory sword"])
      )
      const before = readFileSync(saved, "utf8")
      commandPlay(parseOptions([...options, "--save", saved, "state"]))
      expect(readFileSync(saved, "utf8")).toBe(before)
      const view = JSON.parse(output.mock.calls.at(-1)![0] as string)
      const record = JSON.parse(before)
      expect(view.save).toEqual({
        rng: record.rng,
        serial: record.serial,
        save: record.save,
      })
      commandPlay(
        parseOptions([...options, "--save", saved, "buy armory sword"])
      )
      const split = JSON.parse(output.mock.calls.at(-1)![0] as string)
      commandPlay(
        parseOptions([
          ...options,
          "--new",
          "--save",
          whole,
          "buy armory sword",
          "buy armory sword",
        ])
      )
      const uninterrupted = JSON.parse(output.mock.calls.at(-1)![0] as string)
      expect(split.save).toEqual(uninterrupted.save)
      expect(split.view).toEqual(uninterrupted.view)
      expect(JSON.parse(readFileSync(saved, "utf8"))).toEqual(
        JSON.parse(readFileSync(whole, "utf8"))
      )
    })

for (const seed of [1, 2, 3, 42])
  test(`random auto decisions match across CLI process boundaries, seed=${seed}`, () => {
    const folder = mkdtempSync(join(tmpdir(), "dnd-cli-policy-resumption-"))
    folders.push(folder)
    const saved = join(folder, "split.json")
    const whole = join(folder, "whole.json")
    const output = vi.spyOn(console, "log").mockImplementation(() => {})
    const options = [
      "play",
      "--json",
      "--seed",
      String(seed),
      "--style",
      "random",
    ]
    commandPlay(
      parseOptions([
        ...options,
        "--scene",
        "battle-layer2",
        "--new",
        "--save",
        whole,
        ...Array<string>(8).fill("auto"),
      ])
    )
    const expected = JSON.parse(output.mock.calls.at(-1)![0] as string)
    expect(
      expected.log.some((line: string) => line.startsWith("エラー:"))
    ).toBe(false)
    commandPlay(
      parseOptions([
        ...options,
        "--scene",
        "battle-layer2",
        "--new",
        "--save",
        saved,
        "auto",
      ])
    )
    for (let step = 1; step < 8; step++) {
      commandPlay(parseOptions([...options, "--save", saved, "auto"]))
      const result = JSON.parse(output.mock.calls.at(-1)![0] as string)
      expect(
        result.log.some((line: string) => line.startsWith("エラー:"))
      ).toBe(false)
    }
    const actual = JSON.parse(output.mock.calls.at(-1)![0] as string)
    expect(actual.save).toEqual(expected.save)
    expect(actual.policyRng).toBe(expected.policyRng)
    expect(actual.view).toEqual(expected.view)
    expect(JSON.parse(readFileSync(saved, "utf8"))).toEqual(
      JSON.parse(readFileSync(whole, "utf8"))
    )
  })

for (const invalid of [null, false, "123", -1, 0.5, 0x100000000])
  test(`an unreadable policy RNG cannot overwrite its saved bytes: ${JSON.stringify(invalid)}`, () => {
    const folder = mkdtempSync(join(tmpdir(), "dnd-cli-invalid-policy-"))
    folders.push(folder)
    const file = join(folder, "save.json")
    vi.spyOn(console, "log").mockImplementation(() => {})
    commandPlay(
      parseOptions(["play", "--new", "--json", "--save", file, "state"])
    )
    const saved = JSON.parse(readFileSync(file, "utf8"))
    saved.policyRng = invalid
    const before = JSON.stringify(saved)
    writeFileSync(file, before)
    expect(() =>
      commandPlay(parseOptions(["play", "--json", "--save", file, "auto"]))
    ).toThrow("自動方策の乱数記録を読み込めません")
    expect(readFileSync(file, "utf8")).toBe(before)
  })

test("a legacy save without policy RNG keeps the gameplay snapshot and initializes its separate stream", () => {
  const folder = mkdtempSync(join(tmpdir(), "dnd-cli-legacy-policy-"))
  folders.push(folder)
  const file = join(folder, "save.json")
  vi.spyOn(console, "log").mockImplementation(() => {})
  commandPlay(
    parseOptions([
      "play",
      "--new",
      "--json",
      "--save",
      file,
      "buy armory sword",
    ])
  )
  const legacy = JSON.parse(readFileSync(file, "utf8"))
  delete legacy.policyRng
  writeFileSync(file, JSON.stringify(legacy))
  commandPlay(parseOptions(["play", "--json", "--save", file, "state"]))
  const current = JSON.parse(readFileSync(file, "utf8"))
  expect({ ...current, policyRng: undefined }).toEqual({
    ...legacy,
    policyRng: undefined,
  })
  expect(Number.isInteger(current.policyRng)).toBe(true)
  expect(current.policyRng).toBeGreaterThanOrEqual(0)
  expect(current.policyRng).toBeLessThanOrEqual(0xffffffff)
})

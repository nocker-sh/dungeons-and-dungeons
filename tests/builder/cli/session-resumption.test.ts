import { afterEach, expect, test, vi } from "vite-plus/test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
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

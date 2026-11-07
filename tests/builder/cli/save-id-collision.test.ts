import { afterEach, expect, test, vi } from "vite-plus/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { commandPlay } from "@/builder/cli/command-play"
import { parseOptions } from "@/builder/cli/options"

const folders: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true })
})

for (const source of ["browser", "old-counter"] as const)
  test(`${source} save cannot reuse allocated CLI gear IDs`, () => {
    const folder = mkdtempSync(join(tmpdir(), "dnd-save-id-"))
    folders.push(folder)
    const file = join(folder, "save.json")
    vi.spyOn(console, "log").mockImplementation(() => {})
    const run = (command: string) =>
      commandPlay(parseOptions(["play", "--json", "--save", file, command]))
    commandPlay(
      parseOptions([
        "play",
        "--json",
        "--new",
        "--seed",
        "42",
        "--save",
        file,
        "state",
      ])
    )
    // The ID source is a local starting condition. Gear is acquired by the real purchase.
    const initial = JSON.parse(readFileSync(file, "utf8"))
    initial.serial = 1000
    writeFileSync(file, JSON.stringify(initial))
    run("buy armory sword")
    run("buy armory sword")
    const acquired = JSON.parse(readFileSync(file, "utf8"))
    expect(acquired.serial).toBe(1002)
    expect(
      acquired.save.snapshot.gear.some(
        (gear: { id: string }) => gear.id === "g1001"
      )
    ).toBe(true)
    // Browser transfer keeps the game envelope and omits CLI-only continuation metadata.
    writeFileSync(
      file,
      JSON.stringify(
        source === "browser"
          ? { save: acquired.save }
          : { ...acquired, serial: 1000 }
      )
    )
    run("state")
    const reopened = JSON.parse(readFileSync(file, "utf8"))
    expect(reopened.serial).toBe(1000)
    expect(reopened.save).toEqual(acquired.save)
    run("buy armory sword")
    const after = JSON.parse(readFileSync(file, "utf8"))
    const ids = after.save.snapshot.gear.map((gear: { id: string }) => gear.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(after.serial).toBe(1003)
    expect(after.save.snapshot.gear.slice(0, -1)).toEqual(
      acquired.save.snapshot.gear
    )
    expect(after.save.snapshot.gear).toHaveLength(
      acquired.save.snapshot.gear.length + 1
    )
    const beforeReopen = readFileSync(file, "utf8")
    expect(() => run("state")).not.toThrow()
    expect(readFileSync(file, "utf8")).toBe(beforeReopen)
  })

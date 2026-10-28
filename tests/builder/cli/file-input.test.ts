import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Session } from "@/builder/lib/session"
import { parseCommand } from "@/builder/lib/commands"
import { parseOptions } from "@/builder/cli/options"
import { commandPlay } from "@/builder/cli/command-play"

const folders: string[] = []
function fixtureFolder() {
  const folder = mkdtempSync(join(tmpdir(), "dnd-cli-file-input-"))
  folders.push(folder)
  return folder
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true })
})

describe("CLIの行単位ファイル入力", () => {
  it.each(["技#1", '技"#1', String.raw`技\"#1`, String.raw`技\\`, "#"])(
    "--sets内のJSON文字列を切り詰めない: %s",
    (name) => {
      const file = join(fixtureFolder(), "overrides.txt")
      const override = `skills.brawl.name=${JSON.stringify(name)}`
      writeFileSync(
        file,
        `# 調整用\r\n\r\n  ${override} # 表示名\r\nfoes.kamokutsu.hp=123 # HP\r\n`
      )
      const options = parseOptions(["battle", "--sets", file])
      expect(options.overrides).toEqual([override, "foes.kamokutsu.hp=123"])
      const session = Session.create(options.overrides)
      expect(session.catalog.skill(session.id("brawl", "skills"))?.name).toBe(
        name
      )
      expect(session.catalog.foe(session.id("kamokutsu", "foes"))?.hp).toBe(123)
    }
  )

  it("台本のJSON中の#とエスケープを保ち、直接指定と同じ装備を売却・保存する", () => {
    const folder = fixtureFolder()
    const session = Session.create()
    session.must(parseCommand(session, "buy armory sword"))
    const sword = session.state.gear.find(
      (gear) => gear.good === session.id("sword", "goods") && !gear.owner
    )!
    const gearId = 'loot\\"#1'
    session.patch((state) => {
      state.gear.find((gear) => gear.id === sword.id)!.id = gearId
    })
    const before = session.dump()
    const command = JSON.stringify({ type: "sell", gear: gearId })
    const script = join(folder, "moves.txt")
    writeFileSync(script, `# 売却\r\n\r\n  ${command} # 指定した個体\r\n`)
    const output = vi.spyOn(console, "log").mockImplementation(() => {})
    const saved = ["direct", "script"].map((mode) => {
      const save = join(folder, `${mode}.json`)
      writeFileSync(save, JSON.stringify({ seed: 1, ...before }))
      commandPlay(
        parseOptions([
          "play",
          "--save",
          save,
          "--json",
          ...(mode === "direct" ? [command] : ["--script", script]),
        ])
      )
      const result = JSON.parse(output.mock.calls.at(-1)![0])
      expect(result.log).toHaveLength(2)
      expect(result.log[0]).toBe(`$ ${command}`)
      expect(result.log.join("\n")).not.toMatch(/拒否:|エラー:/)
      return JSON.parse(readFileSync(save, "utf8"))
    })
    expect(saved[1]).toEqual(saved[0])
    const after = saved[1].save.snapshot
    expect(after.gear.some((gear: { id: string }) => gear.id === gearId)).toBe(
      false
    )
    expect(after.bag).toEqual(before.save.snapshot.bag)
    expect(after.gold).toBeGreaterThan(before.save.snapshot.gold)
  })
})

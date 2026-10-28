import { describe, expect, it } from "vite-plus/test"
import { readdirSync, readFileSync } from "node:fs"
import { resolve, relative } from "node:path"
import { parseCommand } from "@/builder/lib/commands"
import { equipBestArmor } from "@/builder/lib/policy/equip-best-armor"
import { startParty } from "@/builder/lib/policy/start-party"
import { Session } from "@/builder/lib/session"
import { battleTrials } from "@/builder/lib/simulation/battle-trials"
import { judge, TARGETS } from "@/builder/targets"

const root = resolve(import.meta.dirname, "../..")
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(dir, entry.name))
      : /\.tsx?$/.test(entry.name)
        ? [resolve(dir, entry.name)]
        : []
  )
}

describe("ブラウザなしで動かす", () => {
  it("エンジン・作品データ・builder は React・DOM・画面に触れない", () => {
    const sources = [
      ...files(resolve(root, "builder")),
      ...files(resolve(root, "content")),
    ]
    for (const file of sources) {
      const text = readFileSync(file, "utf8")
      expect(text, relative(root, file)).not.toMatch(
        /from\s+["'](?:react(?:-dom)?(?:\/|["'])|@\/client\/)/
      )
      expect(text, relative(root, file)).not.toMatch(
        /\b(?:window|document|localStorage)\s*\./
      )
    }
  })

  it("同じ種なら同じプレイになり、保存から続きを再現できる", () => {
    const play = (steps: string[]) => {
      const session = Session.create([], 42)
      // 出撃には3人と悪魔が要る（始めたては主人公ひとり）
      startParty(session)
      for (const step of steps) session.must(parseCommand(session, step))
      return session
    }
    const first = play(["depart layer0", "advance n1"])
    const second = play(["depart layer0", "advance n1"])
    expect(second.state).toEqual(first.state)
    const resumed = new Session(first.built, 42, first.dump())
    expect(resumed.state).toEqual(first.state)
  })

  it("拾った防具を買い物前に使い、別の仲間の防具や職業制限を尊重する", () => {
    const session = Session.create([], 2)
    startParty(session)
    const armor = session.catalog.good(session.id("gravekeeper-vest", "goods"))!
    session.patch((state) => {
      state.gear.push({
        id: "found-armor",
        good: armor.id,
        plus: 0,
        progress: 0,
        wear: 0,
        owner: null,
        weapon: null,
      })
    })
    const beforeGold = session.state.gold
    equipBestArmor(session)
    const found = session.state.gear.find(
      (entry) => entry.id === "found-armor"
    )!
    expect(found.owner).not.toBeNull()
    expect(session.state.party).toContain(found.owner)
    expect(session.catalog.canEquip(found.owner!, armor.id)).toBe(true)
    expect(session.state.gold).toBe(beforeGold)
    const after = session.state
    equipBestArmor(session)
    expect(session.state).toBe(after)
    expect(session.queries.problems(session.state)).toEqual([])
  })

  it("上書きは slug で指せて、元のデータを変えない", () => {
    const strong = Session.create(["foes.hiyokobu.atk=99"])
    const plain = Session.create()
    const id = strong.id("hiyokobu", "foes")
    expect(strong.catalog.foe(id)?.atk).toBe(99)
    expect(plain.catalog.foe(id)?.atk).not.toBe(99)
  })

  it("攻撃だけより、ワザと回復を使う方がボスに強い", () => {
    const run = (style: "smart" | "attack") =>
      battleTrials({
        overrides: [],
        foes: ["haribote-adult"],
        boss: true,
        runs: 30,
        seed: 1,
        style,
        // 素の武器のままでは攻撃力が育たないので、店の武器に持ち替えて比べる
        setup: { level: 8, weapons: true },
      }).win.p
    expect(run("smart")).toBeGreaterThan(run("attack"))
  }, 120_000)
})

/**
 * 層をまたぐ一周（街と探索をくり返して踏破するまで）の目標は、一度測るのに数分かかる。
 * ふだんのテストでは戦闘の目標だけを測り、一周の目標は
 * `vp run cli check`（または `BUILDER_CAMPAIGN=1 vp test run`）で測る。
 */
const spansLayers = (id: string) => id.startsWith("campaign")
const measureCampaign = process.env.BUILDER_CAMPAIGN === "1"

describe("バランスの目標（builder/targets.ts）", () => {
  for (const target of TARGETS) {
    const run = spansLayers(target.id) && !measureCampaign ? it.skip : it
    run(
      `${target.id}: ${target.label}`,
      () => {
        const value = target.measure({ overrides: [], runs: 100, seed: 1 })
        expect(judge(target, value), `${target.id} = ${value}`).toBe(true)
      },
      900_000
    )
  }
})

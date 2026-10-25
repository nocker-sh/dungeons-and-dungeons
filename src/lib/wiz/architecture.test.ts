import { describe, expect, it } from "vite-plus/test"
import { readdirSync, readFileSync } from "node:fs"
import { resolve, relative } from "node:path"
import { createHash } from "node:crypto"
import provenance from "@/lib/wiz/core/provenance.json"

const engineRoot = resolve(import.meta.dirname)

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? sourceFiles(resolve(root, entry.name))
      : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
        ? [resolve(root, entry.name)]
        : []
  )
}

function testFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? testFiles(resolve(root, entry.name))
      : entry.name.endsWith(".test.ts")
        ? [resolve(root, entry.name)]
        : []
  )
}

/** core を除いたエンジン本体のソース。 */
function engineFiles() {
  return sourceFiles(engineRoot).filter(
    (file) => !relative(engineRoot, file).startsWith("core")
  )
}

function exportedClasses(source: string) {
  return [...source.matchAll(/^export (?:abstract )?class (\w+)/gm)].map(
    (match) => match[1]
  )
}

function importedPaths(source: string) {
  return [...source.matchAll(/from\s+["'](@\/lib\/wiz\/[^"']+)["']/g)].map(
    (match) => match[1]
  )
}

describe("エンジンの境界", () => {
  it("受入条件・担当クラス・テストのIDを一対一で保つ", () => {
    const features = readFileSync(
      resolve(engineRoot, "../../../.docs/features.md"),
      "utf8"
    )
    const tests = testFiles(engineRoot)
      .map((file) => readFileSync(file, "utf8"))
      .join("\n")
    const owners = sourceFiles(resolve(engineRoot, "application")).flatMap(
      (file) =>
        [
          ...readFileSync(file, "utf8").matchAll(
            /static readonly featureId = "(W\d+)"/g
          ),
        ].map((match) => match[1])
    )
    const specifications = [...features.matchAll(/^## (W\d+):/gm)].map(
      (match) => match[1]
    )
    expect(new Set(owners).size).toBe(owners.length)
    expect(owners.toSorted()).toEqual(specifications.toSorted())
    for (const id of specifications) expect(tests).toContain(`[feature:${id}]`)
  })

  it("React・DOM・画面・作品データ・保存先をエンジンに持ち込まない", () => {
    for (const file of sourceFiles(engineRoot)) {
      const source = readFileSync(file, "utf8")
      // testing だけは作品データを読む（入口は1ファイルに限る。次のテストで確かめる）
      expect(source, relative(engineRoot, file)).not.toMatch(
        relative(engineRoot, file).startsWith("testing")
          ? /from\s+["'](?:react(?:-dom)?(?:\/|["'])|@\/components\/|@\/contexts\/|@\/lib\/game-client\/)/
          : /from\s+["'](?:react(?:-dom)?(?:\/|["'])|@\/components\/|@\/contexts\/|@\/lib\/content\/|@\/lib\/game-client\/)/
      )
      expect(source, relative(engineRoot, file)).not.toMatch(
        /\b(?:window|document|localStorage|sessionStorage)\s*\./
      )
      // 乱数・時計・IDは WizWorldEnvironment から受け取る（core は既定値として持つ）
      if (!relative(engineRoot, file).startsWith("core"))
        expect(source, relative(engineRoot, file)).not.toMatch(
          /\bMath\.random\(|\bDate\.now\(|crypto\.randomUUID\(/
        )
    }
  })

  it("1ファイル1モジュール：クラスを2つ以上 export しない", () => {
    for (const file of engineFiles()) {
      const classes = exportedClasses(readFileSync(file, "utf8"))
      expect(
        classes.length,
        `${relative(engineRoot, file)}: ${classes.join(", ")}`
      ).toBeLessThanOrEqual(1)
    }
  })

  it("ユースケースは互いを import しない（共有は rules と application の共通部品だけ）", () => {
    const useCases = sourceFiles(resolve(engineRoot, "application")).filter(
      (file) =>
        /static readonly featureId = "W\d+"/.test(readFileSync(file, "utf8"))
    )
    const modulePath = (file: string) =>
      `@/lib/wiz/${relative(engineRoot, file).replace(/\.ts$/, "")}`
    const useCasePaths = new Set(useCases.map(modulePath))
    for (const file of useCases)
      for (const imported of importedPaths(readFileSync(file, "utf8")))
        expect(
          useCasePaths.has(imported),
          `${relative(engineRoot, file)} が ${imported} を import している`
        ).toBe(false)
  })

  it("testing は作り物のデータを持たず、作品データを1つの入口からだけ読む", () => {
    const testingRoot = resolve(engineRoot, "testing")
    const entry = resolve(testingRoot, "real-content.ts")
    for (const file of sourceFiles(testingRoot)) {
      const source = readFileSync(file, "utf8")
      const path = relative(engineRoot, file)
      if (file !== entry) expect(source, path).not.toMatch(/@\/lib\/content\//)
      // 作り物の作品データ（名前を持つ定義）を testing に書かない
      expect(source, path).not.toMatch(/\bname:\s*["'`]/)
    }
  })

  it("エンジンのテストは作品データを testing 経由で受け取る", () => {
    for (const file of testFiles(engineRoot))
      expect(
        readFileSync(file, "utf8"),
        relative(engineRoot, file)
      ).not.toMatch(/@\/lib\/content\//)
  })

  it("テスト用の差し替え（testing）を製品のコードから使わない", () => {
    for (const file of engineFiles()) {
      if (relative(engineRoot, file).startsWith("testing")) continue
      expect(
        readFileSync(file, "utf8"),
        relative(engineRoot, file)
      ).not.toMatch(/@\/lib\/wiz\/testing/)
    }
  })

  it("公開する名前（index.ts）を保つ", () => {
    const source = readFileSync(resolve(engineRoot, "index.ts"), "utf8")
    const exported = [...source.matchAll(/^\s{2}(?:type\s+)?(\w+),$/gm)]
      .map((match) => match[1])
      .concat(
        [...source.matchAll(/^export (?:type )?\{ ([^}]+) \} from/gm)].flatMap(
          (match) =>
            match[1].split(",").map((name) => name.trim().replace(/^type /, ""))
        )
      )
    for (const name of [
      "Game",
      "GameCommandError",
      "GameSnapshot",
      "GameDefinition",
      "SAVE_REVISION",
      "GameRules",
      "GameCatalog",
      "ContentError",
      "GameContent",
      "StateIntegrityError",
      "GameQueries",
      "SLOT_NAMES",
      "STATUS_NAMES",
      "WEAPON_TYPE_NAMES",
      "BattleRules",
      "ExpeditionRules",
      "PartyRules",
      "WeaponRules",
      "WizWorldEnvironment",
      "GameAction",
      "BattleCommand",
      "ActionResult",
      "ActorRef",
      "Gear",
      "GameEvent",
      "GameReason",
      "GameState",
      "LevelUp",
      "Stack",
      "WeaponIndividual",
      "phaseOf",
      "inPhase",
      "eventsOf",
      "TownPhase",
      "ExpeditionPhase",
      "PendingPhase",
      "MemberTurnPhase",
      "FoeTurnPhase",
      "Phase",
      "Step",
      "AfterTurn",
      "AfterAdvance",
      "EventKind",
      "Rarity",
      "Role",
      "Row",
      "StatusKind",
      "WeaponType",
      "Target",
    ])
      expect(exported, name).toContain(name)
  })

  it("画面はフェーズのクラスを通してだけ操作する（game.send を直接呼ばない）", () => {
    const uiRoots = ["../../components", "../../contexts"].map((dir) =>
      resolve(engineRoot, dir)
    )
    const files = (root: string): string[] =>
      readdirSync(root, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? files(resolve(root, entry.name))
          : /\.tsx?$/.test(entry.name)
            ? [resolve(root, entry.name)]
            : []
      )
    for (const file of uiRoots.flatMap(files))
      expect(
        readFileSync(file, "utf8"),
        relative(engineRoot, file)
      ).not.toMatch(/\.send(?:Unknown)?\(/)
  })

  it("複製元の全ソースとテストを保持し、移植差分を追跡する", () => {
    expect(provenance.files.length).toBe(437)
    for (const entry of provenance.files) {
      const body = readFileSync(resolve(engineRoot, "core", entry.path))
      expect(createHash("sha256").update(body).digest("hex"), entry.path).toBe(
        entry.localSha256
      )
    }
  })
})

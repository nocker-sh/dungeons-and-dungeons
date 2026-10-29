import { verifySpatialDocument } from "@/scripts/concept-check/spatial"
import { spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { afterEach, describe, expect, it } from "vite-plus/test"

const roots: string[] = []
const cli = resolve("scripts/check-concept.ts")
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const repository = mkdtempSync(join(tmpdir(), "dnd-concept-"))
  roots.push(repository)
  const root = join(repository, ".docs/concept")
  mkdirSync(root, { recursive: true })
  const write = (
    name: string,
    data: Record<string, unknown>,
    body = `# ${name}`
  ) => {
    const file = join(root, `${name}.md`)
    writeFileSync(
      file,
      `---\n${JSON.stringify({ schema_version: 2, entity_type: "site", ...data })}\n---\n\n${body}\n`
    )
  }
  const room: Record<string, unknown> = {
    schema_version: 2,
    id: "room:a",
    entity_type: "room",
    spatial: {
      width_m: 4,
      depth_m: 5,
      ceiling_m: 2.7,
      capacity: 1,
      egress: "扉から屋外へ",
      beds: [{ x_m: 0.1, y_m: 0.2, width_m: 0.9, depth_m: 2.1 }],
    },
    life_support: Object.fromEntries(
      [
        "sleep",
        "food",
        "water",
        "wash",
        "toilet",
        "air",
        "light",
        "storage",
        "access",
      ].map((key) => [key, { target: "room:a", provision: `${key}の設備` }])
    ),
  }
  write("a", room)
  return {
    root,
    write,
    room,
    run: () => spawnSync("bun", [cli, root], { encoding: "utf8" }),
  }
}
describe("設定資料の実ファイル検査", () => {
  it("設定の属性を資料へ複製せずJSON正本から読む", () => {
    const { root, room, run } = fixture()
    const database = resolve(root, "../../concept/lore")
    mkdirSync(database, { recursive: true })
    writeFileSync(join(database, "room.json"), JSON.stringify(room))
    writeFileSync(
      join(root, "a.md"),
      '---\n{"entity":"[[concept/lore/room.json]]"}\n---\n# 客室\n'
    )
    expect(run().status).toBe(0)
    writeFileSync(
      join(database, "room.json"),
      JSON.stringify({ ...room, spatial: { width_m: -1 } })
    )
    expect(run().status).toBe(1)
  })
  it("Wikiリンクの正本と資料参照を同じIDで照合する", () => {
    const { root, write, run } = fixture()
    writeFileSync(
      resolve(root, "../../profiles.json"),
      JSON.stringify([{ id: "person:a" }])
    )
    writeFileSync(
      join(root, "coverage.json"),
      JSON.stringify({
        sources: [{ file: "[[profiles.json]]", collection: "array" }],
      })
    )
    write("person", {
      id: "person:a",
      entity_type: "person",
      runtime: { file: "[[profiles.json]]", id: "person:a" },
      related: [{ id: "room:a", document: "[[concept/a|客室]]" }],
    })
    expect(run().status).toBe(0)
    write("person", {
      id: "person:a",
      entity_type: "person",
      runtime: { file: "[[profiles.json]]", id: "person:a" },
      related: [{ id: "room:a", document: "[[concept/person]]" }],
    })
    const rejected = run()
    expect(rejected.status).toBe(1)
    expect(rejected.stderr).toContain("relatedのIDとファイルが一致しない")
  })
  it.each([
    { label: "存在するID", rows: [{ id: "person:a" }], valid: true },
    { label: "存在しないID", rows: [], valid: false },
    {
      label: "重複したID",
      rows: [{ id: "person:a" }, { id: "person:a" }],
      valid: false,
    },
  ])("会話プロフィールの出典を照合する: $label", ({ rows, valid }) => {
    const { root, write, run } = fixture()
    writeFileSync(resolve(root, "../../profiles.json"), JSON.stringify(rows))
    write("person", {
      id: "person:a",
      entity_type: "person",
      livelihood: {
        canonical_profile: { file: "profiles.json", id: "person:a" },
      },
    })
    const result = run()
    expect(result.status).toBe(valid ? 0 : 1)
    if (!valid) {
      expect(result.stderr).toContain("livelihood.canonical_profile")
      expect(result.stderr).toContain(
        "runtimeのIDが存在しない・一意でない person:a"
      )
    }
  })
  it("会話プロフィールの出典ファイルがなければ失敗する", () => {
    const { write, run } = fixture()
    write("person", {
      id: "person:a",
      entity_type: "person",
      livelihood: {
        canonical_profile: { file: "missing.json", id: "person:a" },
      },
    })
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("livelihood.canonical_profile")
    expect(result.stderr).toContain("実行用JSONを読めない missing.json")
  })
  it("一室の床を重なる矩形の和で表せるが、別室との重なりは拒否する", () => {
    const { write, room, run } = fixture()
    write("a", {
      ...room,
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        footprint: [
          { x_m: 0, y_m: 0, width_m: 4, depth_m: 2 },
          { x_m: 0, y_m: 0, width_m: 2, depth_m: 5 },
        ],
      },
    })
    write("b", {
      ...room,
      id: "room:b",
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        width_m: 2,
        depth_m: 3,
      },
    })
    const map = (x: number) => ({
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 4, depth_m: 5 },
      placements: [
        { target: "room:a", level: 0, x_m: 0, y_m: 0 },
        { target: "room:b", level: 0, x_m: x, y_m: 2 },
      ],
    })
    write("map", map(2))
    expect(run().status).toBe(0)
    write("map", map(1.8))
    expect(run().stderr).toContain("room:bとroom:aの室内が重複")
  })
  it("地図の配置先と、部屋から参照する地図が一致する", () => {
    const { write, room, run } = fixture()
    write("a", { ...room, location: { parent: "map:a", map: "map:b" } })
    write("map-b", { id: "map:b", entity_type: "map" })
    write("map-a", {
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 4, depth_m: 5 },
      placements: [{ target: "room:a", level: 0, x_m: 0, y_m: 0 }],
    })
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("配置先とlocation.mapが一致しない room:a")
  })
  it("同じ階に同じ部屋を離して二つ配置できない", () => {
    const { write, run } = fixture()
    write("map", {
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 10, depth_m: 5 },
      placements: [
        { target: "room:a", level: 0, x_m: 0, y_m: 0 },
        { target: "room:a", level: 0, x_m: 6, y_m: 0 },
      ],
    })
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("同じ階の配置が重複 room:a (0)")
  })
  it("階段の同じ区画を異なる階に配置できる", () => {
    const { write, run } = fixture()
    write("stairs", {
      id: "zone:stairs",
      entity_type: "room-zone",
      spatial: { width_m: 1.2, depth_m: 4.4 },
      location: { parent: "map:a", map: "map:a" },
    })
    write("map", {
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 1.2, depth_m: 4.4 },
      placements: [
        { target: "zone:stairs", level: 0, x_m: 0, y_m: 0 },
        { target: "zone:stairs", level: 1, x_m: 0, y_m: 0 },
      ],
    })
    expect(run().status).toBe(0)
  })
  it("循環しない親子関係と共通の地図を参照できる", () => {
    const { write, run } = fixture()
    write("map", { id: "map:a", entity_type: "map" })
    write("town", { id: "town", location: { parent: "map:a", map: "map:a" } })
    write("building", {
      id: "building",
      location: { parent: "town", map: "map:a" },
    })
    write("site", {
      id: "site",
      location: { parent: "building", map: "map:a" },
    })
    expect(run().status).toBe(0)
  })
  it.each([true, false])(
    "場所の親子関係の循環を拒否する（自己参照%s）",
    (self) => {
      const { write, run } = fixture()
      write("map", { id: "map:a", entity_type: "map" })
      write("one", {
        id: "one",
        location: { parent: self ? "one" : "two", map: "map:a" },
      })
      write("two", { id: "two", location: { parent: "one", map: "map:a" } })
      const result = run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("場所の親子関係が循環")
      expect(result.stderr.match(/場所の親子関係が循環/g)).toHaveLength(1)
    }
  )
  it("存在する部屋でも地図の代わりには参照できない", () => {
    const { write, run } = fixture()
    write("site", { id: "site", location: { parent: "room:a", map: "room:a" } })
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("location.mapが地図ではない room:a")
  })
  it("YAMLとJSONのFront Matterを再帰的に読める", () => {
    const { root, run } = fixture()
    mkdirSync(join(root, "nested"))
    writeFileSync(
      join(root, "nested/b.md"),
      "---\nschema_version: 1\nid: legacy\n---\n# 旧資料\n"
    )
    expect(run().status).toBe(0)
  })
  it.each([undefined, 0, 3, "2"])(
    "未対応のメタデータ版を拒否する: %s",
    (version) => {
      const { write, room, run } = fixture()
      write("a", { ...room, schema_version: version })
      const result = run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("未対応のschema_version")
    }
  )
  it.each([undefined, "rom"])(
    "第2版の対象種別の欠落や誤記を拒否する: %s",
    (entityType) => {
      const { write, room, run } = fixture()
      write("a", { ...room, entity_type: entityType })
      const result = run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain("entity_typeが不正")
    }
  )
  it.each(["livelihood", "handling", "ecology"])(
    "本文の生活・手入れの参照先を検査する: %s",
    (field) => {
      const { write, room, run } = fixture()
      const data = { ...room, [field]: { routine_section: "日々の手入れ" } }
      write("a", data)
      expect(run().stderr).toContain(
        `${field}.routine_sectionの見出しが一意に存在しない`
      )
      write("a", data, "# 部屋\n\n## 日々の手入れ\n\n道具を片付ける。")
      expect(run().status).toBe(0)
      write(
        "a",
        data,
        "# 部屋\n\n## 日々の手入れ\n\n道具を片付ける。\n\n## 日々の手入れ\n\n違う説明。"
      )
      expect(run().status).toBe(1)
    }
  )
  it.each(["```md\n## 生活\n```", "<!--\n## 生活\n-->", "    ## 生活"])(
    "コード例やコメント内の見出しを参照先として数えない: %s",
    (example) => {
      const { write, room, run } = fixture()
      write(
        "a",
        { ...room, livelihood: { routine_section: "生活" } },
        `# 部屋\n\n${example}`
      )
      expect(run().stderr).toContain(
        "livelihood.routine_sectionの見出しが一意に存在しない"
      )
    }
  )
  it.each(["## **生活**", "生活\n---", "## 生活 ##"])(
    "Markdownの表示上の見出しへ参照できる: %s",
    (heading) => {
      const { write, room, run } = fixture()
      write(
        "a",
        { ...room, livelihood: { routine_section: "生活" } },
        `# 部屋\n\n${heading}\n\n道具を片付ける。`
      )
      expect(run().status).toBe(0)
    }
  )

  it("重複IDを拒否する", () => {
    const { write, room, run } = fixture()
    write("duplicate", room)
    expect(run().stderr).toContain("id重複 room:a")
    expect(run().status).toBe(1)
  })
  it.each(["room", "room-zone"])(
    "飲用水の資料が存在しなければ失敗する: %s",
    (entityType) => {
      const { write, room, run } = fixture()
      ;(room.life_support as Record<string, unknown>).water = {
        target: "missing",
        provision: "飲用水",
      }
      write("a", { ...room, entity_type: entityType })
      const result = run()
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(
        "life_support.waterの参照先がない missing"
      )
    }
  )
  it("生活設備の説明が空なら失敗する", () => {
    const { write, room, run } = fixture()
    ;(room.life_support as Record<string, unknown>).toilet = {
      target: "room:a",
      provision: " ",
    }
    write("a", room)
    expect(run().stderr).toContain("life_support.toiletの具体的な設備が必要")
  })
  it.each([0, -1, "4"])("室内寸法%sを受理しない", (width) => {
    const { write, room, run } = fixture()
    ;(room.spatial as Record<string, unknown>).width_m = width
    write("a", room)
    expect(run().status).toBe(1)
  })
  it("同階の重複を拒否し、別階の同位置は許す", () => {
    const { write, room, run } = fixture()
    write("b", { ...room, id: "room:b" })
    const map = (level: number) => ({
      schema_version: 2,
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 10, depth_m: 10 },
      placements: [
        { target: "room:a", level: 0, x_m: 0, y_m: 0 },
        { target: "room:b", level, x_m: 0, y_m: 0 },
      ],
    })
    write("map", map(0))
    expect(run().stderr).toContain("室内が重複")
    write("map", map(1))
    expect(run().status).toBe(0)
  })
  it("建物からはみ出す部屋を拒否する", () => {
    const { write, run } = fixture()
    write("map", {
      schema_version: 2,
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 5, depth_m: 5 },
      placements: [{ target: "room:a", level: 0, x_m: 2, y_m: 0 }],
    })
    expect(run().stderr).toContain("建物からはみ出す")
  })
  it("関連先のIDが正しくてもファイルの取り違えを拒否する", () => {
    const { write, room, run } = fixture()
    write("a", { ...room, related: [{ id: "room:a", document: "wrong.md" }] })
    expect(run().stderr).toContain("relatedのIDとファイルが一致しない")
  })
  it("実行用データの消えたIDを検出する", () => {
    const { root, write, room, run } = fixture()
    writeFileSync(
      resolve(root, "../../data.json"),
      JSON.stringify([{ id: "current" }])
    )
    write("a", { ...room, runtime: { file: "data.json", id: "removed" } })
    expect(run().stderr).toContain(
      "runtimeのIDが存在しない・一意でない removed"
    )
  })
  it("同名地点が別の層にあっても親の取り違えを許さない", () => {
    const { root, write, room, run } = fixture()
    writeFileSync(
      resolve(root, "../../data.json"),
      JSON.stringify([
        { id: "layer0", stations: [{ id: "s" }] },
        { id: "layer1", stations: [] },
      ])
    )
    write("a", {
      ...room,
      runtime: { file: "data.json", parent_id: "layer1", id: "s" },
    })
    expect(run().status).toBe(1)
    write("a", {
      ...room,
      runtime: { file: "data.json", parent_id: "layer0", id: "s" },
    })
    expect(run().status).toBe(0)
  })
  it("地図に載る地点の欠落を検出する", () => {
    const { write, run } = fixture()
    write("map", {
      id: "map:a",
      entity_type: "map",
      topology: { nodes: ["room:a", "missing"] },
    })
    expect(run().stderr).toContain("topology.nodesの参照先がない missing")
  })
  it.each([
    {
      beds: [{ x_m: 0, y_m: 0, width_m: 0.9, depth_m: 1.8 }],
      capacity: 1,
      error: "寝台の寸法・配置が不正",
    },
    {
      beds: [
        { x_m: 0, y_m: 0, width_m: 0.9, depth_m: 2.1 },
        { x_m: 0.5, y_m: 0, width_m: 0.9, depth_m: 2.1 },
      ],
      capacity: 2,
      error: "寝台が重複",
    },
    {
      beds: [{ x_m: 0, y_m: 0, width_m: 0.9, depth_m: 2.1 }],
      capacity: 2,
      error: "寝台数と就寝人数が一致しない",
    },
  ])("寝台の不整合を検出する: $error", ({ beds, capacity, error }) => {
    const { write, room, run } = fixture()
    write("a", {
      ...room,
      spatial: { ...(room.spatial as Record<string, unknown>), beds, capacity },
    })
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(error)
  })
  it("外接矩形の中でもL字の欠けた床には寝台を置けない", () => {
    const { write, room, run } = fixture()
    const spatial = {
      ...(room.spatial as Record<string, unknown>),
      footprint: [
        { x_m: 0, y_m: 0, width_m: 4, depth_m: 2 },
        { x_m: 0, y_m: 2, width_m: 2, depth_m: 3 },
      ],
      beds: [{ x_m: 2.5, y_m: 2.5, width_m: 0.9, depth_m: 2.1 }],
    }
    write("a", { ...room, spatial })
    expect(run().stderr).toContain("寝台が室内の床からはみ出す")
    // 分割線を跨いでも、実際の床が連続する側なら寝台を置ける。
    write("a", {
      ...room,
      spatial: {
        ...spatial,
        beds: [{ x_m: 0.5, y_m: 1, width_m: 0.9, depth_m: 2.1 }],
      },
    })
    expect(run().status).toBe(0)
  })
  it("L字形の室内は欠けた部分の別室と重複しない", () => {
    const { write, room, run } = fixture()
    write("a", {
      ...room,
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        width_m: 4,
        depth_m: 5,
        ceiling_m: 2.7,
        capacity: 1,
        egress: "出口",
        footprint: [
          { x_m: 0, y_m: 0, width_m: 4, depth_m: 2 },
          { x_m: 0, y_m: 2, width_m: 2, depth_m: 3 },
        ],
      },
    })
    write("b", {
      ...room,
      id: "room:b",
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        width_m: 2,
        depth_m: 3,
        ceiling_m: 2.7,
        capacity: 1,
        egress: "出口",
      },
    })
    write("map", {
      schema_version: 2,
      entity_type: "map",
      id: "map:a",
      bounds: { width_m: 4, depth_m: 5 },
      placements: [
        { target: "room:a", level: 0, x_m: 0, y_m: 0 },
        { target: "room:b", level: 0, x_m: 2, y_m: 2 },
      ],
    })
    expect(run().status).toBe(0)
    write("b", { ...room, id: "room:b" })
    expect(run().status).toBe(1)
  })
  it("正本の項目に資料がなければ検出する", () => {
    const { root, run } = fixture()
    writeFileSync(
      resolve(root, "../../data.json"),
      JSON.stringify([{ id: "person:missing" }])
    )
    writeFileSync(
      join(root, "coverage.json"),
      JSON.stringify({ sources: [{ file: "data.json", collection: "array" }] })
    )
    expect(run().stderr).toContain("個別資料がない person:missing")
  })
  it("資料IDがあっても別の正本しか参照しない資料を検出する", () => {
    const { root, write, room, run } = fixture()
    writeFileSync(
      resolve(root, "../../data.json"),
      JSON.stringify([{ id: "room:a" }])
    )
    writeFileSync(
      join(root, "coverage.json"),
      JSON.stringify({ sources: [{ file: "data.json", collection: "array" }] })
    )
    expect(run().stderr).toContain("正本との対応がない data.json")
    write("a", { ...room, runtime: { file: "data.json", id: "room:a" } })
    expect(run().status).toBe(0)
  })
  it("動物の生活設備も参照先を検査する", () => {
    const { write, room, run } = fixture()
    write("pet", { id: "creature:pet" })
    const support = {
      ...(room.life_support as Record<string, unknown>),
      occupant: "creature:pet",
      food: { target: "missing", provision: "専用の食器" },
    }
    write("a", { ...room, animal_support: support })
    expect(run().stderr).toContain("animal_support.foodの参照先がない missing")
  })
  it("別のデータIDを同じ対象の資料へ束ねられる", () => {
    const { root, write, room, run } = fixture()
    writeFileSync(
      resolve(root, "../../data.json"),
      JSON.stringify([{ id: "tier:normal" }])
    )
    writeFileSync(
      join(root, "coverage.json"),
      JSON.stringify({ sources: [{ file: "data.json", collection: "array" }] })
    )
    write("a", {
      ...room,
      bindings: [{ file: "data.json", id: "tier:normal" }],
    })
    expect(run().status).toBe(0)
    write("duplicate", {
      id: "room:b",
      bindings: [{ file: "data.json", id: "tier:normal" }],
    })
    expect(run().stderr).toContain("対応する資料が一意でない tier:normal")
  })
  it("戸口の両側がずれた接続と、寝台で塞いだ入口を検出する", () => {
    const { write, room, run } = fixture()
    write("b", { ...room, id: "room:b" })
    const connection = (offset: number) => ({
      level: 0,
      width_m: 0.9,
      height_m: 2.1,
      a: { target: "room:a", wall: "east", offset_m: 3 },
      b: { target: "room:b", wall: "west", offset_m: offset },
    })
    const map = {
      schema_version: 2,
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 9, depth_m: 5 },
      placements: [
        { target: "room:a", level: 0, x_m: 0, y_m: 0 },
        { target: "room:b", level: 0, x_m: 4.2, y_m: 0 },
      ],
      doors: [connection(3)],
    }
    write("map", map)
    expect(run().status).toBe(0)
    // CLIの受入を一度確認し、配置の変形は純粋な同じ検査へ渡す。
    // 異常配置ごとにBunを再起動する必要はない。
    const inspect = (candidate: Record<string, unknown>, first = room) => {
      const problems: string[] = []
      verifySpatialDocument(
        "map.md",
        candidate,
        (_file, id) =>
          id === "room:a"
            ? first
            : id === "room:b"
              ? { ...room, id: "room:b" }
              : undefined,
        problems
      )
      return problems
    }
    expect(inspect(map)).toEqual([])
    expect(inspect({ ...map, doors: [connection(1)] })).toContain(
      "map.md: 両側の戸口の位置がつながらない"
    )
    const blocked = {
      ...room,
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        beds: [{ x_m: 3.1, y_m: 2.9, width_m: 0.9, depth_m: 2.1 }],
      },
    }
    expect(inspect(map, blocked)).toContain(
      "map.md: 寝台が戸口の前を塞ぐ room:a"
    )
  })
  it.each([
    { part: -1, height: 2.1, error: "戸口の室内形状の指定が不正" },
    { part: 99, height: 2.1, error: "戸口の室内形状の指定が不正" },
    { part: 0, height: 3, error: "戸口が天井より高い" },
  ])("成立しない戸口を拒否する: $error", ({ part, height, error }) => {
    const { write, room, run } = fixture()
    write("a", {
      ...room,
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        footprint: [{ x_m: 0, y_m: 0, width_m: 4, depth_m: 5 }],
      },
    })
    write("b", { ...room, id: "room:b" })
    write("map", {
      schema_version: 2,
      id: "map:a",
      entity_type: "map",
      bounds: { width_m: 9, depth_m: 5 },
      placements: [
        { target: "room:a", level: 0, x_m: 0, y_m: 0 },
        { target: "room:b", level: 0, x_m: 4.2, y_m: 0 },
      ],
      doors: [
        {
          level: 0,
          width_m: 0.9,
          height_m: height,
          a: { target: "room:a", wall: "east", offset_m: 3, part },
          b: { target: "room:b", wall: "west", offset_m: 3 },
        },
      ],
    })
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(error)
  })
  it("共用設備から各自の寝室へ複数の接続先を持てる", () => {
    const { write, room, run } = fixture()
    const support = {
      ...(room.life_support as Record<string, unknown>),
      sleep: { targets: ["room:a", "missing"], provision: "各自の寝室へ帰る" },
    }
    write("a", { ...room, life_support: support })
    expect(run().stderr).toContain("life_support.sleepの参照先がない missing")
    write("b", { ...room, id: "missing" })
    expect(run().status).toBe(0)
  })
  it("寝台のない作業室を就寝先や住まいにできない", () => {
    const { write, room, run } = fixture()
    write("work", {
      ...room,
      id: "room:work",
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        beds: undefined,
      },
    })
    write("person", {
      id: "person:a",
      entity_type: "person",
      relations: [{ type: "resides_in", target: "room:work" }],
    })
    write("a", {
      ...room,
      life_support: {
        ...(room.life_support as Record<string, unknown>),
        sleep: { target: "room:work", provision: "仕事のあとに寝る" },
      },
    })
    const result = run()
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("就寝先に寝台がない room:work")
    expect(result.stderr).toContain("住まいに寝台がない room:work")
  })
  it("暮らしを設計した人物の寝床参照を省略できない", () => {
    const { write, run } = fixture()
    const person = {
      id: "person:guest",
      entity_type: "person",
      tags: ["暮らし"],
    }
    write("guest", person)
    expect(run().stderr).toContain("常住先または条件付き宿泊先がない")
    write("guest", {
      ...person,
      relations: [{ type: "resides_in", target: "room:a" }],
    })
    expect(run().status).toBe(0)
  })

  it("条件付きの宿泊先にも寝台と本文の動線を求める", () => {
    const { write, room, run } = fixture()
    const person = {
      id: "person:guest",
      entity_type: "person",
      livelihood: {
        lodging: {
          target: "room:a",
          condition: "宿泊契約の期間だけ",
          routine_section: "宿泊時の動線",
        },
      },
    }
    write("guest", person, "# 客人\n\n## 宿泊時の動線\n寝台から廊下へ出る。")
    expect(run().status).toBe(0)
    write("a", {
      ...room,
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        beds: undefined,
      },
    })
    expect(run().stderr).toContain("宿泊先に寝台がない room:a")
    write("a", room)
    write("guest", person)
    expect(run().stderr).toContain("livelihood.lodging.routine_section")
  })

  it("常住する人数が寝室の定員を超えない", () => {
    const { write, room, run } = fixture()
    for (const id of ["one", "two"])
      write(id, {
        id: `person:${id}`,
        entity_type: "person",
        relations: [{ type: "resides_in", target: "room:a" }],
      })
    expect(run().stderr).toContain("常住人数が寝室の定員を超える room:a")
    write("a", {
      ...room,
      spatial: {
        ...(room.spatial as Record<string, unknown>),
        capacity: 2,
        beds: [
          { x_m: 0.1, y_m: 0.2, width_m: 0.9, depth_m: 2.1 },
          { x_m: 2.1, y_m: 0.2, width_m: 0.9, depth_m: 2.1 },
        ],
      },
    })
    expect(run().status).toBe(0)
  })
  it("地図の地点と各地点の進行先を正本と照合する", () => {
    const { root, write, run } = fixture()
    writeFileSync(
      resolve(root, "../../data.json"),
      JSON.stringify([
        {
          id: "layer",
          stations: [
            { id: "a", next: ["b"] },
            { id: "b", next: [] },
          ],
        },
      ])
    )
    const binding = (id: string) => ({
      file: "data.json",
      parent_id: "layer",
      id,
    })
    write("a", { id: "layer:station:a", runtime: binding("a"), relations: [] })
    write("b", { id: "layer:station:b", runtime: binding("b"), relations: [] })
    write("map", {
      id: "map:a",
      runtime: { file: "data.json", id: "layer" },
      topology: { nodes: ["layer:station:a"] },
    })
    const broken = run()
    expect(broken.stderr).toContain("進行先が正本と一致しない")
    expect(broken.stderr).toContain("地図の地点一覧が正本と一致しない")
    write("a", {
      id: "layer:station:a",
      runtime: binding("a"),
      relations: [{ type: "route_to", target: "layer:station:b" }],
    })
    write("map", {
      id: "map:a",
      runtime: { file: "data.json", id: "layer" },
      topology: { nodes: ["layer:station:a", "layer:station:b"] },
    })
    expect(run().status).toBe(0)
  })
})

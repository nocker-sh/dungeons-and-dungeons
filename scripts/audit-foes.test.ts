import { describe, expect, it } from "vite-plus/test"
import { auditFoes } from "@/scripts/audit-foes"
const definitions = [
  { id: "base", slug: "base" },
  { id: "variant", slug: "variant" },
]
const layers = [
  {
    foes: ["base"],
    boss: "base",
    weights: { battle: 1, treasure: 1 },
    stations: [{ event: "battle" }],
  },
]
describe("敵の登場状況", () => {
  it("外見違いを未配置と誤認しない", () => {
    const result = auditFoes(
      definitions,
      [
        { id: "base", appearances: [{ image: "variant.webp" }] },
        { id: "variant", image: "variant.webp" },
      ],
      layers
    )
    expect(result.entries.map((entry) => entry.status)).toEqual([
      "直接登場",
      "外見候補",
    ])
    expect(result.problems).toEqual([])
  })
  it("未使用の親にだけ登録されても登場済みにはしない", () => {
    const result = auditFoes(
      definitions,
      [
        {
          id: "variant",
          appearances: [{ image: "variant.webp" }],
          image: "variant.webp",
        },
      ],
      layers
    )
    expect(result.entries[1]!.status).toBe("未使用")
    expect(result.problems).toHaveLength(1)
  })
  it("不採用の定義の保持は許し、登場への復活は拒否する", () => {
    const art = [{ id: "variant", category: "不採用", image: "variant.webp" }]
    expect(auditFoes(definitions, art, layers).problems).toEqual([])
    expect(
      auditFoes(definitions, art, [
        { ...layers[0]!, foes: ["base", "variant"] },
      ]).problems
    ).toHaveLength(1)
    expect(
      auditFoes(
        definitions,
        [{ id: "base", appearances: [{ image: "variant.webp" }] }, ...art],
        layers
      ).problems
    ).toHaveLength(1)
  })
})

it("未知の宝箱のミミックを数え、確率0や安全な固定宝箱は数えない", () => {
  const layer = {
    foes: [],
    boss: "base",
    weights: { battle: 1, treasure: 1 },
    stations: [{}],
    treasure: { mimic: { foe: "variant", chance: 0.15 } },
  }
  expect(auditFoes(definitions, [], [layer]).entries[1]!.status).toBe(
    "直接登場"
  )
  expect(
    auditFoes(
      definitions,
      [],
      [{ ...layer, treasure: { mimic: { foe: "variant", chance: 0 } } }]
    ).entries[1]!.status
  ).toBe("未使用")
  expect(
    auditFoes(
      definitions,
      [],
      [{ ...layer, stations: [{ event: "treasure" }] }]
    ).entries[1]!.status
  ).toBe("未使用")
})

it("抽選率0と地点の上書きを尊重し、固定戦闘では抽選率に依存しない", () => {
  const layer = {
    foes: ["variant"],
    boss: "base",
    weights: { battle: 0, treasure: 0 },
    stations: [{}],
    treasure: { mimic: { foe: "variant", chance: 1 } },
  }
  expect(auditFoes(definitions, [], [layer]).entries[1]!.status).toBe("未使用")
  expect(
    auditFoes(definitions, [], [{ ...layer, stations: [{ event: "battle" }] }])
      .entries[1]!.status
  ).toBe("直接登場")
  expect(
    auditFoes(
      definitions,
      [],
      [{ ...layer, stations: [{ weights: { battle: 0, treasure: 1 } }] }]
    ).entries[1]!.status
  ).toBe("直接登場")
  expect(
    auditFoes(
      definitions,
      [],
      [
        {
          ...layer,
          weights: { battle: 1, treasure: 1 },
          stations: [{ weights: { battle: 0, treasure: 0 } }],
        },
      ]
    ).entries[1]!.status
  ).toBe("未使用")
  expect(
    auditFoes(
      definitions,
      [],
      [{ ...layer, stations: [{ event: "discovery", foes: ["variant"] }] }]
    ).entries[1]!.status
  ).toBe("未使用")
})

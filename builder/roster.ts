/**
 * 仲間と構成の比較。
 *   vp exec bun builder/roster.ts [試行数]
 * 方針：レア度は強さではなく効果の珍しさ。一人ずつの能力は控えめでも、構成とビルド次第で同じ強さになる。
 * 基本はタンク・ヒール・ダメージの構成。
 *
 * 1. 役割の枠：構成（基準・毒・守り）の、その仲間の役割の枠に一人ずつ入れる。
 *    「一番合う構成での勝率」が同じ役割の中でそろっているかを見る（合う仲間と組んで強くなる個性を潰さない）。
 * 2. 構成：役割がそろった構成と、タンクやヒールを欠いた構成で差があるか（構成の価値）を見る。
 * 場面：序盤のボス（0層・Lv6）、中盤のボス（2層・Lv12）、中盤の群れ（2層の敵3体・Lv8）。結果は JSON 行。
 */
import { RosterTrials } from "@/builder/lib/roster-trials"
import { contentSource } from "@/content/game-content"
import { readFileSync } from "node:fs"

const overrides = process.argv[4]
  ? readFileSync(process.argv[4], "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
  : []
const trials = new RosterTrials(overrides)
const runs = Number(process.argv[2] ?? 20)
const seed = Number(process.argv[3] ?? 1)
if (!Number.isInteger(runs) || runs < 1) throw new Error("試行数は正の整数")
if (!Number.isInteger(seed) || seed < 1) throw new Error("開始シードは正の整数")

const scenarios =
  process.argv[5] === "endgame"
    ? [
        {
          name: "最深層・育成済み",
          level: 26,
          reached: 4,
          foes: ["slime-swordsman"],
          boss: true,
          plus: 30,
        },
      ]
    : [
        {
          name: "序盤のボス",
          level: 6,
          reached: 0,
          foes: ["haribote-adult"],
          boss: true,
          plus: 0,
        },
        {
          name: "中盤のボス",
          level: 12,
          reached: 2,
          foes: ["kabemimi-fortress"],
          boss: true,
          plus: 8,
        },
        {
          name: "中盤の群れ",
          level: 8,
          reached: 2,
          foes: ["yadocup-fire", "oumuku", "peripoke"],
          boss: false,
          plus: 8,
        },
      ]

/** 役割ごとの組み合わせ。毒（毒を入れる仲間と組む）・守り（守りの加護と遠距離）。 */
const bases = {
  基準: { tank: "alda", healer: "mort" },
  毒: { tank: "gald", healer: "jig" },
  守り: { tank: "sera", healer: "sion" },
} as const

/**
 * 役割の枠に入れた並び（左2人が前衛、右1人が後衛）。主人公と2人なので、ダメージ役は
 * タンクの代わりに前衛へ入れる並びと、ヒールの代わりに後衛へ入れる並びの両方を試す。
 * 後衛からの近接攻撃は被害が半分になるので、近接で戦う仲間は前衛に置く遊び方も比べる。
 */
const slotParties = (
  base: { tank: string; healer: string },
  role: string,
  slug: string
) =>
  role === "tank"
    ? [["hero", slug, base.healer]]
    : role === "healer"
      ? [["hero", base.tank, slug]]
      : [
          ["hero", base.tank, slug],
          ["hero", slug, base.healer],
        ]

for (const recruit of contentSource.recruits.filter(
  (entry) => !(entry as { retired?: boolean }).retired
)) {
  const member = recruit.member
  for (const scenario of scenarios)
    for (const [baseName, base] of Object.entries(bases))
      for (const [order, party] of slotParties(
        base,
        member.role,
        member.slug
      ).entries())
        console.log(
          JSON.stringify({
            kind: "slot",
            name: member.name,
            slug: member.slug,
            role: member.role,
            rank: (recruit as { rank?: string }).rank ?? "N",
            scenario: scenario.name,
            base:
              member.role === "damage"
                ? `${baseName}・${order ? "前衛" : "後衛"}`
                : baseName,
            ...trials.runScenario(party, { ...scenario, seed }, runs),
          })
        )
}

const compositions = [
  { name: "タンク・ヒール", party: ["hero", "alda", "sion"] },
  { name: "タンク・ヒール（毒）", party: ["hero", "gald", "jig"] },
  { name: "ヒールなし", party: ["hero", "alda", "mayu"] },
  { name: "タンクなし", party: ["hero", "mayu", "sion"] },
  { name: "ダメージだけ", party: ["hero", "mayu", "luca"] },
]
for (const composition of compositions)
  for (const scenario of scenarios)
    console.log(
      JSON.stringify({
        kind: "composition",
        name: composition.name,
        scenario: scenario.name,
        ...trials.runScenario(composition.party, { ...scenario, seed }, runs),
      })
    )

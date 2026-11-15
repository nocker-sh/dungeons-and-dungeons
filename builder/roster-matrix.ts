import { RosterTrials } from "@/builder/lib/roster-trials"
import { readFileSync } from "node:fs"

const presets = [
  // プレイヤーは戦わないので、主人公がいた枠には初期の攻撃役マユを入れる
  { name: "初期編成", party: ["alda", "mort", "mayu"] },
  { name: "毒と修復", party: ["mayu", "jig", "mort"] },
  { name: "全体防護と救援", party: ["mayu", "alda", "alma"] },
  { name: "扉と修復", party: ["mayu", "clef", "mort"] },
  { name: "妨害と修復", party: ["mayu", "nem", "mort"] },
  { name: "防護と修復", party: ["mayu", "sera", "mort"] },
  { name: "吸収と狙撃", party: ["mayu", "husky", "rio"] },
  { name: "妨害と速攻", party: ["mayu", "nem", "rio"] },
  { name: "吸収と即時回復", party: ["mayu", "husky", "sion"] },
  { name: "防護と救援", party: ["mayu", "clef", "alma"] },
]
const scenarios = [
  {
    name: "結晶のボス",
    level: 6,
    reached: 0,
    foes: ["haribote-adult"],
    boss: true,
    plus: 0,
  },
  {
    name: "墓地のボス",
    level: 10,
    reached: 1,
    foes: ["washinoko-adult"],
    boss: true,
    plus: 8,
  },
  {
    name: "錆のボス",
    level: 14,
    reached: 2,
    foes: ["kabemimi-fortress"],
    boss: true,
    plus: 16,
  },
  {
    name: "温室のボス",
    level: 18,
    reached: 3,
    foes: ["yukimebae"],
    boss: true,
    plus: 24,
  },
  {
    name: "祭壇のボス",
    level: 22,
    reached: 4,
    foes: ["slime-swordsman"],
    boss: true,
    plus: 30,
  },
  {
    name: "鉄橋の群れ",
    level: 12,
    reached: 2,
    foes: ["yadocup-fire", "kemurimaki-ash", "oumuku"],
    boss: false,
    plus: 16,
  },
  {
    name: "毒に強い群れ",
    level: 16,
    reached: 3,
    foes: ["kuragesa", "tsubomimu", "horopoppo-poison"],
    boss: false,
    plus: 24,
  },
]
const overrides = process.argv[5]
  ? readFileSync(process.argv[5], "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
  : []
const trials = new RosterTrials(overrides)
const runs = Number(process.argv[2] ?? 20)
const seed = Number(process.argv[3] ?? 1)
const training = process.argv[4] ?? "stress"
if (!Number.isInteger(runs) || runs < 1) throw new Error("試行数は正の整数")
if (!Number.isInteger(seed) || seed < 1) throw new Error("開始シードは正の整数")
if (training !== "stress" && training !== "ready")
  throw new Error("育成条件は stress または ready")
const selectedScenarios =
  process.argv[6] === "endgame"
    ? scenarios.filter((scenario) => scenario.reached === 4 && scenario.boss)
    : scenarios
for (const scenario of selectedScenarios)
  for (const preset of presets)
    console.log(
      JSON.stringify({
        name: preset.name,
        scenario: scenario.name,
        seed,
        training,
        ...trials.runScenario(
          preset.party,
          {
            ...scenario,
            seed,
            level: scenario.level + (training === "ready" ? 4 : 0),
          },
          runs
        ),
      })
    )

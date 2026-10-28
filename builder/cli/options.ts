import { z } from "zod"
import { readLineFile } from "@/builder/cli/line-file"
import { DEFAULT_PLAN, PUSH_PLAN } from "@/builder/lib/policy/expedition"
import type { ExpeditionPlan } from "@/builder/lib/policy/expedition"
import type { BattleStyle } from "@/builder/lib/policy/battle"

const battleStyleSchema = z.enum(["smart", "attack", "random"])

const numberRules = {
  positive: { schema: z.number().int().positive(), label: "1以上の整数" },
  count: { schema: z.number().int().nonnegative(), label: "0以上の整数" },
  seed: { schema: z.number().int(), label: "整数" },
  ratio: { schema: z.number().min(0).max(1), label: "0から1までの数値" },
  depth: { schema: z.number().nonnegative(), label: "0以上の数値" },
} as const

export type CliOptions = {
  positional: string[]
  runs: number
  seed: number
  overrides: string[]
  json: boolean
  style: BattleStyle
  level?: number
  boss: boolean
  plan: ExpeditionPlan
  save?: string
  fresh: boolean
  expeditions: number
  layers: number
  potions: number
  shop: boolean
  values: string[]
  parameterPath?: string
  metric?: string
  /** 店の武器に持ち替えた状態で測る。 */
  weapons: boolean
  /** 到達した層の深さ（その層までに並ぶ武器・防具で測る）。 */
  reached?: number
  /** depth：引き返す地点の深さ（地点の x）の一覧。 */
  depths?: number[]
  /** ai：始める場面（/previews の slug）。 */
  scene?: string
  /** ai：操作を1行ずつ書いた台本のファイル。 */
  script?: string
  /** --runs が指定されたか（tune の既定を変えるため）。 */
  runsGiven: boolean
  /** tune で使う種。候補はこの全てで合格させる。 */
  seeds?: number[]
  /** tune の測定回数の上限。 */
  budget?: number
  /** tune の書き出し先。 */
  outputPath?: string
  /** tune で満たす目標（spec の targets を上書き）。 */
  targetIds?: string[]
  /** tune が成功したら JSON へ書き戻す。 */
  apply: boolean
  /** check / report で前回の結果を使い回す（--no-cache で切る）。 */
  cache: boolean
}

export function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    positional: [],
    runs: 200,
    seed: 1,
    overrides: [],
    json: false,
    style: "smart",
    boss: false,
    plan: { ...DEFAULT_PLAN },
    fresh: false,
    expeditions: 30,
    layers: 2,
    potions: 4,
    shop: true,
    values: [],
    weapons: false,
    runsGiven: false,
    apply: false,
    cache: true,
  }
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    const readNext = () => {
      const value = argv[++index]
      if (value === undefined) throw new Error(`${argument} の値がない`)
      return value
    }
    const readNumber = (rule: keyof typeof numberRules, value = readNext()) => {
      const { schema, label } = numberRules[rule]
      const parsed = schema.safeParse(value.trim() ? Number(value) : NaN)
      if (!parsed.success)
        throw new Error(
          `${argument} は${label}で指定してください: ${JSON.stringify(value)}`
        )
      return parsed.data
    }
    if (argument === "--runs") {
      options.runs = readNumber("positive")
      options.runsGiven = true
    } else if (argument === "--seed") options.seed = readNumber("seed")
    else if (argument === "--seeds")
      options.seeds = readNext()
        .split(",")
        .map((value) => readNumber("seed", value))
    else if (argument === "--budget") options.budget = readNumber("positive")
    else if (argument === "--out") options.outputPath = readNext()
    else if (argument === "--targets") options.targetIds = readNext().split(",")
    else if (argument === "--apply") options.apply = true
    else if (argument === "--no-cache") options.cache = false
    else if (argument === "--set") options.overrides.push(readNext())
    else if (argument === "--sets")
      options.overrides.push(...readLineFile(readNext()))
    else if (argument === "--json") options.json = true
    else if (argument === "--style") {
      const value = readNext()
      const parsed = battleStyleSchema.safeParse(value)
      if (!parsed.success)
        throw new Error(
          `--style は ${battleStyleSchema.options.join(" / ")} で指定してください: ${JSON.stringify(value)}`
        )
      options.style = parsed.data
    } else if (argument === "--level") options.level = readNumber("positive")
    else if (argument === "--boss") options.boss = true
    else if (argument === "--push") options.plan = { ...PUSH_PLAN }
    else if (argument === "--retreat")
      options.plan.retreatBelow = readNumber("ratio")
    else if (argument === "--boss-ready")
      options.plan.bossReady = readNumber("ratio")
    else if (argument === "--no-heal") options.plan.heal = false
    else if (argument === "--save") options.save = readNext()
    else if (argument === "--new") options.fresh = true
    else if (argument === "--expeditions")
      options.expeditions = readNumber("positive")
    else if (argument === "--layers") options.layers = readNumber("positive")
    else if (argument === "--potions") options.potions = readNumber("count")
    else if (argument === "--no-shop") options.shop = false
    else if (argument === "--weapons") options.weapons = true
    else if (argument === "--reached") options.reached = readNumber("count")
    else if (argument === "--depths")
      options.depths = readNext()
        .split(",")
        .map((value) => readNumber("depth", value))
    else if (argument === "--scene") options.scene = readNext()
    else if (argument === "--script") options.script = readNext()
    else if (argument === "--param") options.parameterPath = readNext()
    else if (argument === "--values") options.values = readNext().split(",")
    else if (argument === "--metric") options.metric = readNext()
    else options.positional.push(argument)
  }
  return options
}

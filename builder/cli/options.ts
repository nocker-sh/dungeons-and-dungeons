import { readFileSync } from "node:fs"
import {
  DEFAULT_PLAN,
  PUSH_PLAN,
  type BattleStyle,
  type ExpeditionPlan,
} from "../lib/policy"

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
    if (argument === "--runs") {
      options.runs = Number(readNext())
      options.runsGiven = true
    } else if (argument === "--seed") options.seed = Number(readNext())
    else if (argument === "--seeds")
      options.seeds = readNext().split(",").map(Number).filter(Number.isFinite)
    else if (argument === "--budget") options.budget = Number(readNext())
    else if (argument === "--out") options.outputPath = readNext()
    else if (argument === "--targets") options.targetIds = readNext().split(",")
    else if (argument === "--apply") options.apply = true
    else if (argument === "--no-cache") options.cache = false
    else if (argument === "--set") options.overrides.push(readNext())
    else if (argument === "--sets")
      options.overrides.push(
        ...readFileSync(readNext(), "utf8")
          .split("\n")
          .map((line) => line.replace(/#.*/, "").trim())
          .filter(Boolean)
      )
    else if (argument === "--json") options.json = true
    else if (argument === "--style") options.style = readNext() as BattleStyle
    else if (argument === "--level") options.level = Number(readNext())
    else if (argument === "--boss") options.boss = true
    else if (argument === "--push") options.plan = { ...PUSH_PLAN }
    else if (argument === "--retreat")
      options.plan.retreatBelow = Number(readNext())
    else if (argument === "--boss-ready")
      options.plan.bossReady = Number(readNext())
    else if (argument === "--no-heal") options.plan.heal = false
    else if (argument === "--save") options.save = readNext()
    else if (argument === "--new") options.fresh = true
    else if (argument === "--expeditions")
      options.expeditions = Number(readNext())
    else if (argument === "--layers") options.layers = Number(readNext())
    else if (argument === "--potions") options.potions = Number(readNext())
    else if (argument === "--no-shop") options.shop = false
    else if (argument === "--weapons") options.weapons = true
    else if (argument === "--reached") options.reached = Number(readNext())
    else if (argument === "--depths")
      options.depths = readNext()
        .split(",")
        .map((value) => Number(value))
    else if (argument === "--scene") options.scene = readNext()
    else if (argument === "--script") options.script = readNext()
    else if (argument === "--param") options.parameterPath = readNext()
    else if (argument === "--values") options.values = readNext().split(",")
    else if (argument === "--metric") options.metric = readNext()
    else options.positional.push(argument)
  }
  return options
}

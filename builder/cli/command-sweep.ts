import type { CliOptions } from "@/builder/cli/options"
import { commandBattle } from "@/builder/cli/command-battle"
import { commandCurve } from "@/builder/cli/command-curve"
import { commandDungeon } from "@/builder/cli/command-dungeon"
import { commandCampaign } from "@/builder/cli/command-campaign"
import { commandReport } from "@/builder/cli/command-report"

/** 一つの数値を振って、指標を並べる。 */
export async function commandSweep(options: CliOptions) {
  if (!options.parameterPath || !options.values.length)
    throw new Error("--param <path> --values a,b,c が要る")
  const metric = options.metric ?? "report"
  for (const value of options.values) {
    const overrides = [
      ...options.overrides,
      `${options.parameterPath}=${value}`,
    ]
    const local = { ...options, overrides, json: false }
    process.stdout.write(`--- ${options.parameterPath}=${value}\n`)
    if (metric === "report") await commandReport(local, false)
    else if (metric.startsWith("battle:")) {
      local.positional = [metric.slice(7)]
      commandBattle(local)
    } else if (metric.startsWith("dungeon:")) {
      local.positional = [metric.slice(8)]
      commandDungeon(local)
    } else if (metric.startsWith("curve:")) {
      local.positional = [metric.slice(6)]
      commandCurve(local)
    } else if (metric === "campaign") commandCampaign(local)
    else throw new Error(`知らない指標: ${metric}`)
  }
}

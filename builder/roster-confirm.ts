import { readFileSync } from "node:fs"
import { RosterTrials } from "@/builder/lib/roster-trials"

/** 探索試行で決めた編成を固定し、別シードで最深層を再測定する。 */
const selected: { slug: string; party: string[] }[] = JSON.parse(
  readFileSync(process.argv[2], "utf8")
)
const runs = Number(process.argv[3] ?? 8)
const seed = Number(process.argv[4] ?? 61)
if (!Number.isInteger(runs) || runs < 1) throw new Error("試行数は正の整数")
if (!Number.isInteger(seed) || seed < 1) throw new Error("開始シードは正の整数")
const overrides = process.argv[5]
  ? readFileSync(process.argv[5], "utf8")
      .split("\n")
      .filter((line) => line.trim() && !line.trim().startsWith("#"))
  : []
const trials = new RosterTrials(overrides)
const rarity = process.argv[6] ?? "N"
if (rarity !== "N" && rarity !== "R" && rarity !== "SR")
  throw new Error("レア度は N・R・SR")
for (const entry of selected)
  console.log(
    JSON.stringify({
      slug: entry.slug,
      seed,
      ...trials.runScenario(
        entry.party,
        {
          level: 26,
          reached: 4,
          foes: ["slime-swordsman"],
          boss: true,
          plus: 30,
          seed,
          rarity,
        },
        runs
      ),
    })
  )

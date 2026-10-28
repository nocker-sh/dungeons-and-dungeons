import type { CampaignRun } from "@/builder/lib/simulation/campaign"

export function perBattle(
  runs: readonly CampaignRun[],
  rounds: "battleRounds" | "bossRounds",
  battles: "battles" | "bossBattles"
) {
  const count = runs.reduce((sum, entry) => sum + entry[battles], 0)
  return count ? runs.reduce((sum, entry) => sum + entry[rounds], 0) / count : 0
}

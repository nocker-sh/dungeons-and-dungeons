import { buildContent } from "@/builder/lib/build-content"
import type { CampaignOptions } from "@/builder/lib/simulation/campaign"
import { campaignRun } from "@/builder/lib/simulation/campaign-run"
import { summarizeCampaign } from "@/builder/lib/simulation/summarize-campaign"

/** 街と探索をくり返す一周を runs 回。 */
export function campaignTrials(options: CampaignOptions) {
  const built = buildContent(options.overrides)
  const runs = Array.from({ length: options.runs }, (_, run) =>
    campaignRun(built, options, run)
  )
  return summarizeCampaign(built, options, runs)
}

import type { WizStandardAffinityLevel } from "@/lib/wiz/core/config/conversation/wiz-conversation-config"

export const WIZ_AFFINITY_LEVEL_NAMES_JA: Readonly<
  Record<WizStandardAffinityLevel, string>
> = Object.freeze({
  stranger: "見知らぬ人",
  acquaintance: "知り合い",
  friend: "友人",
  close_friend: "親友",
  best_friend: "無二の親友",
})

export const WIZ_FACILITY_NAMES_JA: Readonly<Record<string, string>> =
  Object.freeze({
    blacksmith: "鍛冶場",
    alchemy: "錬金術室",
    magic_tower: "魔塔",
    church: "教会",
  })

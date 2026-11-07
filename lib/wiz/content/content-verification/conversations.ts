import { HERO_REGISTERED_FLAG } from "@/lib/wiz/content/constants"
import type { ContentVerification } from "./context"

export function verifyConversations({ catalog, need }: ContentVerification) {
  const data = catalog.data

  const conversationIds = new Set<string>()
  for (const conversation of data.conversations ?? []) {
    need(
      !conversationIds.has(conversation.id),
      `会話 ID が重複: ${conversation.id}`
    )
    conversationIds.add(conversation.id)
    for (const flag of conversation.requires)
      need(
        !conversation.excludes.includes(flag),
        `会話 ${conversation.id} のフラグ ${flag} は要求と除外を同時に指定できない`
      )
    need(
      new Set(conversation.participants).size ===
        conversation.participants.length,
      `会話 ${conversation.id} の話者が重複`
    )
    for (const participant of conversation.participants) {
      need(
        catalog.member(participant) ||
          catalog.demon(participant) ||
          data.conversationResidents?.includes(participant),
        `会話 ${conversation.id} の話者 ${participant} が不明`
      )
      need(
        ["inn", "talk", "visit"].includes(conversation.trigger) ||
          !data.conversationResidents?.includes(participant),
        `会話 ${conversation.id} の住人は探索に同行しない`
      )
    }
    if (conversation.trigger === "talk")
      need(
        data.conversationResidents?.includes(conversation.participants[0]) ||
          catalog.demon(conversation.participants[0]),
        `会話 ${conversation.id} の最初の話者は話しかける住人`
      )
    need(
      (conversation.trigger === "visit") === (conversation.place !== undefined),
      `会話 ${conversation.id} の場所は入ったときの場面だけに指定する`
    )
    need(
      conversation.place === undefined ||
        !!data.conversationPlaces?.includes(conversation.place),
      `会話 ${conversation.id} の場所 ${conversation.place} が不明`
    )
    need(
      conversation.chance === undefined || conversation.trigger === "visit",
      `会話 ${conversation.id} の確率は入ったときの場面だけに指定する`
    )
    for (const line of [
      ...conversation.lines,
      ...(conversation.choice?.options.flatMap((option) => option.lines) ?? []),
    ])
      need(
        conversation.participants.includes(line.speaker),
        `会話 ${conversation.id} に未登録の話者 ${line.speaker}`
      )
    need(
      conversation.minimumReached < data.layers.length,
      `会話 ${conversation.id} の進行度が範囲外`
    )
  }
  // Engine actions are possible entry points; dialogue conditions are checked optimistically.
  const external = [
    HERO_REGISTERED_FLAG,
    ...data.demons
      .filter((demon) => demon.contract?.paper)
      .map((demon) => `demon-called:${demon.id}`),
  ]
  const scripts = (data.conversations ?? []).map((conversation) => ({
    conversation,
    flags: [
      ...conversation.sets,
      ...(conversation.choice?.options.flatMap((option) => option.sets) ?? []),
    ],
  }))
  const raised = new Set([
    ...external,
    ...scripts.flatMap((entry) => entry.flags),
  ])
  for (const conversation of data.conversations ?? [])
    for (const flag of [...conversation.requires, ...conversation.excludes])
      need(
        raised.has(flag),
        `会話 ${conversation.id} のフラグ ${flag} を立てる会話がない`
      )

  // Even with choices combined and exclusions/non-flag conditions ignored, requirements need an entry.
  // This over-approximation detects impossible cycles without rejecting valid exclusive branches.
  const reachable = new Set(external)
  let previous = -1
  while (previous !== reachable.size) {
    previous = reachable.size
    for (const entry of scripts)
      if (entry.conversation.requires.every((flag) => reachable.has(flag)))
        for (const flag of entry.flags) reachable.add(flag)
  }
  for (const conversation of data.conversations ?? [])
    for (const flag of conversation.requires)
      need(
        !raised.has(flag) || reachable.has(flag),
        `会話 ${conversation.id} の要求フラグへ到達できない: ${flag}`
      )
}

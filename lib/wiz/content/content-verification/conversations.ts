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
  // 条件のフラグは、どこかの会話で立てられないと永遠に出ない
  const raised = new Set([
    HERO_REGISTERED_FLAG,
    ...(data.conversations ?? []).flatMap((conversation) => [
      ...conversation.sets,
      ...(conversation.choice?.options.flatMap((option) => option.sets) ?? []),
    ]),
  ])
  for (const conversation of data.conversations ?? [])
    for (const flag of [...conversation.requires, ...conversation.excludes])
      need(
        raised.has(flag),
        `会話 ${conversation.id} のフラグ ${flag} を立てる会話がない`
      )
}

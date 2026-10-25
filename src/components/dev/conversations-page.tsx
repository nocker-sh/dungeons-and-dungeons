import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DevDataLayout } from "./data-layout"
import { gameContent } from "@/lib/content/game-content"
import { conceptEntries } from "@/lib/concept/database"
import { placeName } from "@/lib/content/looks"
import {
  conversationSchema,
  conversationTriggers,
} from "@/lib/wiz/conversations/schema"
const labels = {
  inn: "宿の雑談",
  chest: "宝箱",
  branch: "分岐",
  item: "アイテム入手",
  talk: "住人との会話",
  visit: "場所に入ったときの場面",
  opening: "開幕（街へ着く前）",
}
const initialConversations = conversationSchema
  .array()
  .parse(gameContent.conversations)
const nameOf = (id: string) =>
  conceptEntries.find((entry) => entry.id === id)?.name ?? id
/** フラグを立てる台本の題。条件のフラグがどこで立つかを示す。 */
const settersOf = (flag: string) =>
  initialConversations
    .filter(
      (entry) =>
        entry.sets.includes(flag) ||
        entry.choice?.options.some((option) => option.sets.includes(flag))
    )
    .map((entry) => entry.title)
const flagList = (flags: readonly string[], withSetters = false) =>
  flags.length
    ? flags
        .map((flag) =>
          withSetters ? `${flag}（${settersOf(flag).join("、")}）` : flag
        )
        .join(" / ")
    : "なし"
const spacing = { display: "grid", gap: 12 } as const

export function ConversationsPage({
  selectedSlug,
  onEntryChange,
}: {
  selectedSlug?: string
  onEntryChange: (entry: string) => void
}) {
  const conversations = initialConversations
  const selected = selectedSlug ?? initialConversations[0].id
  const selectedConversation =
    conversations.find((entry) => entry.id === selected) ?? conversations[0]
  const preview = useRef<HTMLIFrameElement>(null)
  const [line, setLine] = useState(0)
  const [previewStart, setPreviewStart] = useState({ line: 0, revision: 0 })
  const [finished, setFinished] = useState(false)
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== preview.current?.contentWindow ||
        event.data?.id !== selected
      )
        return
      if (
        event.data.type === "conversation-line" &&
        Number.isInteger(event.data.line) &&
        event.data.line >= 0 &&
        event.data.line <
          conversations.find((entry) => entry.id === selected)!.lines.length
      )
        setLine(event.data.line)
      if (event.data.type === "conversation-done") setFinished(true)
    }
    addEventListener("message", receive)
    return () => removeEventListener("message", receive)
  }, [selected, conversations])
  const seek = (index: number) => {
    setLine(index)
    setFinished(false)
    setPreviewStart((previous) => ({
      line: index,
      revision: previous.revision + 1,
    }))
  }
  const [filter, setFilter] = useState("")
  useEffect(() => {
    seek(0)
  }, [selected])
  return (
    <DevDataLayout
      category="conversations"
      activeId={selected}
      onEntryChange={onEntryChange}
      sections={conversationTriggers.map((trigger) => ({
        label: labels[trigger],
        entries: conversations
          .filter(
            (conversation) =>
              conversation.trigger === trigger &&
              `${conversation.title} ${conversation.participants.map(nameOf).join(" ")} ${conversation.lines.map((line) => line.text).join(" ")} ${conversation.choice?.options.map((option) => option.label).join(" ") ?? ""}`.includes(
                filter
              )
          )
          .map((conversation) => ({
            id: conversation.id,
            slug: conversation.id,
            name: conversation.title,
          })),
      }))}
      filters={
        <Input
          aria-label="会話を検索"
          placeholder="人物・台本を検索"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      }
    >
      <article style={spacing}>
        <header style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600 }}>
            {selectedConversation.title}
          </h1>
        </header>
        <dl
          aria-label="出現条件"
          style={{
            display: "grid",
            gridTemplateColumns: "max-content 1fr",
            gap: "4px 16px",
            margin: 0,
            fontSize: 14,
          }}
        >
          <dt>場面</dt>
          <dd>
            {labels[selectedConversation.trigger]}
            {selectedConversation.place
              ? `・${placeName(selectedConversation.place)}`
              : ""}
            {selectedConversation.chance !== undefined
              ? `・確率 ${Math.round(selectedConversation.chance * 100)}%`
              : ""}
            {selectedConversation.once ? "・一度きり" : ""}
          </dd>
          <dt>進行</dt>
          <dd>
            到達 {selectedConversation.minimumReached} 層以上・宿の夜{" "}
            {selectedConversation.minimumNights} 以上
            {selectedConversation.minimumBond !== undefined
              ? `・親しさ ${selectedConversation.minimumBond} 以上`
              : ""}
            {selectedConversation.requiresCleared ? "・踏破後" : ""}
          </dd>
          <dt>必要なフラグ</dt>
          <dd>{flagList(selectedConversation.requires, true)}</dd>
          <dt>出なくなるフラグ</dt>
          <dd>{flagList(selectedConversation.excludes, true)}</dd>
          <dt>立てるフラグ</dt>
          <dd>{flagList(selectedConversation.sets)}</dd>
        </dl>
        <iframe
          ref={preview}
          key={`${selected}-${previewStart.revision}`}
          title="会話プレビュー"
          src={`/previews/conversations?id=${encodeURIComponent(selected)}&line=${previewStart.line}`}
          style={{
            width: "100%",
            height: "min(52vh, 440px)",
            minHeight: 300,
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button variant="outline" onClick={() => seek(0)}>
            最初から再生
          </Button>
          <span role="status">
            {finished
              ? "再生終了"
              : `${line + 1} / ${selectedConversation.lines.length}`}
          </span>
        </div>
        <section aria-label="セリフのタイムライン" style={spacing}>
          <h2>セリフ</h2>
          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              borderLeft: "2px solid var(--border)",
            }}
          >
            {selectedConversation.lines.map((entry, index) => (
              <li key={index} style={{ padding: "0 0 8px 12px" }}>
                <Button
                  variant={line === index ? "secondary" : "ghost"}
                  aria-pressed={line === index}
                  onClick={() => seek(index)}
                  style={{
                    width: "100%",
                    height: "auto",
                    padding: 12,
                    display: "grid",
                    justifyItems: "start",
                    justifyContent: "stretch",
                    gap: 6,
                    whiteSpace: "normal",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{ fontSize: 12, color: "var(--muted-foreground)" }}
                  >
                    {index + 1} · {nameOf(entry.speaker)} ·{" "}
                    {
                      {
                        normal: "通常",
                        talk: "会話",
                        happy: "喜び",
                        sigh: "ため息",
                        angry: "怒り",
                        surprised: "驚き",
                        surprisedLarge: "驚き（大）",
                        thinking: "考え中",
                        shy: "照れ",
                        special: "特殊モーション",
                      }[entry.expression]
                    }
                  </span>
                  <span style={{ lineHeight: 1.8 }}>{entry.text}</span>
                </Button>
              </li>
            ))}
          </ol>
          {selectedConversation.choice ? (
            <section aria-label="選択肢" style={spacing}>
              <h3>選択肢：{selectedConversation.choice.ask}</h3>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {selectedConversation.choice.options.map((option) => (
                  <li key={option.label} style={{ lineHeight: 1.8 }}>
                    <strong>{option.label}</strong>
                    {option.sets.length ? (
                      <div style={{ fontSize: 12 }}>
                        立てるフラグ：{flagList(option.sets)}
                      </div>
                    ) : null}
                    {option.lines.map((entry, index) => (
                      <div key={index}>
                        {nameOf(entry.speaker)}：{entry.text}
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </section>
      </article>
    </DevDataLayout>
  )
}

import { useEffect, useRef, useState } from "react"
import { Button } from "@/development/ui/button"
import { Input } from "@/development/ui/input"
import { Textarea } from "@/development/ui/textarea"
import { SidebarInset } from "@/development/ui/sidebar-inset"
import { StudioNavigation } from "@/development/components/studio-navigation"

const gameOrigin = "https://dnd.localhost"

/**
 * 貼り付けたセーブを、ゲーム側のページへiframeのメッセージで送って試遊する。
 * スタジオはゲームを持たず、受け取ったゲームは送ったセーブをメモリだけで遊ぶ。
 */
export default function SavePage() {
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [trial, setTrial] = useState<{ save: string; run: number } | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!trial) return
    // 読込・再読込のたびにゲームから準備の合図が来るので、同じセーブを送り直す。
    const ready = (event: MessageEvent) => {
      const game = frame.current?.contentWindow
      if (
        !game ||
        event.origin !== gameOrigin ||
        event.source !== game ||
        event.data?.type !== "dnd-save-ready"
      )
        return
      game.postMessage({ type: "dnd-save", save: trial.save }, gameOrigin)
    }
    addEventListener("message", ready)
    return () => removeEventListener("message", ready)
  }, [trial])

  const start = () => {
    try {
      JSON.parse(text)
    } catch {
      setError("セーブのJSONとして読めません。")
      return
    }
    setError(null)
    setTrial((current) => ({ save: text, run: (current?.run ?? 0) + 1 }))
  }

  return (
    <>
      <StudioNavigation tool="save" />
      <SidebarInset style={{ height: "100dvh", overflow: "auto" }}>
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: 16,
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              width: 360,
              maxWidth: "100%",
            }}
          >
            <p className="text-sm text-muted-foreground">
              セーブのJSONを貼り付けるかファイルを選び、ゲーム（{gameOrigin}
              ）で試遊する。ゲーム側の本来のセーブは変わらない。
            </p>
            <Input
              type="file"
              accept="application/json,.json"
              aria-label="セーブのファイル"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void file.text().then(setText)
              }}
            />
            <Textarea
              aria-label="セーブのJSON"
              placeholder="セーブのJSON"
              value={text}
              onChange={(event) => setText(event.target.value)}
              style={{ height: 240, fontFamily: "monospace", fontSize: 12 }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={start} disabled={!text.trim()}>
              {trial ? "このセーブで遊び直す" : "試遊を始める"}
            </Button>
          </div>
          {trial && (
            <iframe
              key={trial.run}
              ref={frame}
              title="試遊"
              src={`${gameOrigin}/?save=message`}
              style={{
                width: 390,
                height: 844,
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            />
          )}
        </div>
      </SidebarInset>
    </>
  )
}

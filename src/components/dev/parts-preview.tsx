import { useEffect, useState } from "react"
import { Word, useWide } from "@/components/stage/word"
import { Revolver } from "@/components/stage/revolver"
import { useStage } from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { sceneOf } from "@/lib/content/looks"
import { COLOR } from "@/components/stage/kit"

/** 実際のWord・Revolver・隊列・FXを単独で再生する。同じボタン名をCLIの操作に使える。 */
export function PartsPreview() {
  const stage = useStage()
  const fx = useFx()
  const wide = useWide()
  const [selected, setSelected] = useState(0)
  const entries = [
    { key: "flash", name: "閃光", no: 1, note: "画面を光らせる" },
    {
      key: "cut-in",
      name: "カットイン",
      no: 2,
      note: "文字の登場・保持・退場",
    },
    {
      key: "damage",
      name: "ダメージ",
      no: 3,
      note: "数値・揺れ・ヒットストップ",
    },
    { key: "focus", name: "集中線", no: 4, note: "画面中央へ線が集まる" },
  ]
  useEffect(() => {
    void stage.art(sceneOf("town"))
    stage.bars(2)
  }, [stage])
  const play = (index: number) => {
    const { width, height } = fx.size()
    if (index === 0) fx.flash()
    if (index === 1) void fx.cutIn("スキル発動！", { hold: 800 })
    if (index === 2) {
      fx.shake()
      fx.hitStop()
      fx.numberAt(width * 0.45, height * 0.5, "−128", {
        size: 16,
        color: COLOR.paper,
      })
    }
    if (index === 3) fx.focusLines(width / 2, height / 2, { dur: 900 })
  }
  return (
    <>
      <Revolver
        label="演出の部品"
        items={entries}
        selected={selected}
        onSelect={setSelected}
        onConfirm={play}
      />
      <Word
        text={entries[selected].name}
        size={wide ? 12 : 10}
        paper
        big
        style={{ right: "4vw", bottom: "8%" }}
        onClick={() => play(selected)}
      />
      <div
        style={{
          position: "absolute",
          left: "3vw",
          top: "10%",
          display: "grid",
          gap: 12,
        }}
      >
        {entries.map((entry, index) => (
          <Word
            key={entry.key}
            text={entry.name}
            size={5}
            paper
            delay={index * 120}
            style={{ position: "relative" }}
            onClick={() => play(index)}
          />
        ))}
      </div>
    </>
  )
}

import { useParams, useRouter } from "@void/react"
import { useEffect, useMemo } from "react"
import { GameApp } from "@/components/game/game-app"
import { setTimeScale, stillClock } from "@/components/stage/kit"
import { MotionGlobalConfig } from "motion/react"
import { previews } from "@/components/game/previews"

/**
 * 一つの場面を直接開く（/previews/{slug}）。ゲームと同じ時間で再生する。
 * ?still で繰り返しの動きも止める（見比べ・撮影用）。画面の大きさはブラウザで変える。
 */
export default function PreviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const still = useRouter().query.get("still")
  return <Preview slug={slug} still={still !== null && still !== "0"} />
}

function Preview({ slug, still }: { slug: string; still: boolean }) {
  const preview = useMemo(
    () => previews().find((entry) => entry.slug === slug),
    [slug]
  )
  const start = useMemo(() => preview?.start(), [preview])
  useSettle(still)
  if (!preview || !start)
    return <p style={{ padding: 24 }}>プレビュー {slug} はない</p>
  return <GameApp key={slug} preview={start} />
}

/** 入りの演出を早送りする。still なら繰り返しの動きも止める。 */
function useSettle(still: boolean) {
  useEffect(() => {
    if (!still) return
    // 明示的な静止画モードだけ、開いた直後は待ち時間をほぼ0にして、入りの演出を飛ばす
    setTimeScale(0.02)
    // still なら motion の動きは最初から最後の形にする（くり返しも止まる）
    MotionGlobalConfig.skipAnimations = still
    stillClock.on = still
    const settle = () => {
      for (const animation of document.getAnimations()) {
        const timing = animation.effect?.getTiming()
        if (timing?.iterations === Infinity) {
          if (still) {
            animation.pause()
            animation.currentTime = 0
          }
        } else if (animation.playState !== "finished") animation.finish()
      }
    }
    const timer = setInterval(settle, 50)
    const stop = setTimeout(() => {
      clearInterval(timer)
      settle()
      setTimeScale(1)
    }, 1500)
    return () => {
      clearInterval(timer)
      clearTimeout(stop)
      setTimeScale(1)
      MotionGlobalConfig.skipAnimations = false
      stillClock.on = false
    }
  }, [still])
}

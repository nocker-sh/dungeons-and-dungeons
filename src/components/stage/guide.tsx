import { useStage } from "@/components/stage/stage-context"
import { animationTiming, letterDelay } from "@/components/stage/timing"
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react"
import { COLOR, EASE_IN, EASE_POP } from "@/components/stage/kit"
import { useLeaving } from "@/components/stage/stage-context"
import { usePortrait } from "@/components/stage/word"
import { PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"
import { useGame, useGameState } from "@/contexts/game"

/** 立ち絵の枠（案内人・店主・会話の話し手で共通）。 */
export const GUIDE_BOX: CSSProperties = {
  ...REVERT,
  display: "block",
  position: "absolute",
  left: "-4%",
  bottom: 0,
  height: "96%",
  aspectRatio: 0.62,
  // 傾けても足元が浮かないよう、足元を軸にする
  transformOrigin: "50% 100%",
  pointerEvents: "none",
}

/**
 * 立ち絵の足元は必ず画面の下に付ける。置き場所の style に上下の指定があっても打ち消す
 * （背景のカウンターに合わせて宙に浮かせない）。
 */
export const GUIDE_FEET: CSSProperties = { top: "auto", bottom: 0 }
/** 立ち絵の絵。 */
export const GUIDE_IMAGE: CSSProperties = {
  ...REVERT,
  display: "block",
  maxWidth: "none",
  position: "absolute",
  left: "58%",
  bottom: "-2%",
  height: "104%",
  translate: "-50% 0",
  filter: "drop-shadow(calc(var(--u) * 1.2) calc(var(--u) * 1.2) 0 #0b0c12)",
}

export type GuideHandle = {
  el: HTMLDivElement | null
  /** 立ち絵の絵（会話の演出が明るさや弾みを付ける）。 */
  image: HTMLImageElement | null
  bubble: HTMLDivElement | null
  pop: () => void
}

/**
 * 案内人・店主の立ち絵と漫画の吹き出し。左の外から滑り込む。
 * 吹き出しの文を変えると、ぽんと弾む。
 * 会話の場面の間は退場し、話し手の上半身だけを見せる（ゲーム状態の会話中で決める）。
 */
export const Guide = forwardRef<
  GuideHandle,
  {
    img?: string
    say?: string | null
    className?: string
    style?: CSSProperties
    sayStyle?: CSSProperties
    imgStyle?: CSSProperties
    delay?: number
    rotate?: number
    children?: ReactNode
  }
>(function Guide(
  {
    img,
    say,
    className = "",
    style,
    sayStyle,
    imgStyle,
    delay = 100,
    rotate = -3,
    children,
  },
  handle
) {
  const ref = useRef<HTMLDivElement>(null)
  const image = useRef<HTMLImageElement>(null)
  const bubble = useRef<HTMLDivElement>(null)
  const leaving = useLeaving()
  const stage = useStage()
  const game = useGame()
  const talking = !!game.queries.activeConversation(useGameState())
  const hidden = useRef(false)
  const pop = () =>
    play(
      bubble.current,
      [
        { scale: 1.25, rotate: "-12deg" },
        { scale: 1, rotate: "-5deg" },
      ],
      { duration: 320, easing: EASE_POP }
    )
  useImperativeHandle(handle, () => ({
    el: ref.current,
    image: image.current,
    bubble: bubble.current,
    pop,
  }))
  const enter = (wait: number) =>
    play(
      ref.current,
      [
        {
          transform: `translateX(-80vw) rotate(${rotate - 11}deg)`,
          easing: "cubic-bezier(.16,1,.3,1)",
        },
        {
          transform: `translateX(1vw) rotate(${rotate + 1}deg)`,
          offset: 0.7,
          easing: EASE_POP,
        },
        { transform: `rotate(${rotate}deg)` },
      ],
      { duration: animationTiming.enter, delay: wait, fill: "both" }
    )
  const exit = () =>
    play(
      ref.current,
      [
        { transform: getComputedStyle(ref.current!).transform },
        { transform: "translateX(-80vw) rotate(-14deg)" },
      ],
      { duration: animationTiming.exit, easing: EASE_IN, fill: "both" }
    )
  useLayoutEffect(() => {
    if (talking) {
      // 会話中に着いた場面では、会話が終わってから入る
      hidden.current = true
      play(ref.current, [{ transform: "translateX(-80vw)" }], {
        duration: 0,
        fill: "both",
      })
    } else enter(delay)
    // 入場は一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!ref.current || leaving) return
    if (talking && !hidden.current) {
      hidden.current = true
      exit()
    } else if (!talking && hidden.current) {
      hidden.current = false
      enter(0)
    }
    // 会話の始まりと終わりだけで動かす
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [talking])
  useEffect(() => {
    if (say) pop()
  }, [say])
  useEffect(() => {
    if (!leaving || !ref.current) return
    stage.exits.track(
      play(
        ref.current,
        [
          { transform: getComputedStyle(ref.current).transform },
          { transform: "translateX(-80vw) rotate(-14deg)" },
        ],
        { duration: animationTiming.exit, easing: EASE_IN, fill: "both" }
      )
    )
  }, [leaving])
  const portrait = usePortrait()
  const flip = typeof style?.left === "string" && parseFloat(style.left) > 40
  // 長いセリフで吹き出しが画面の端からはみ出すときは、内側へずらす（入場の変形を除いた配置で測る）
  useLayoutEffect(() => {
    const box = ref.current
    const element = bubble.current
    const parent = box?.offsetParent
    if (!box || !element || !(parent instanceof HTMLElement)) return
    const fit = () => {
      element.style.translate = ""
      const margin = 8
      const left = box.offsetLeft + element.offsetLeft
      const right = left + element.offsetWidth
      const shift =
        left < margin
          ? margin - left
          : right > parent.clientWidth - margin
            ? parent.clientWidth - margin - right
            : 0
      element.style.translate = shift ? `${shift}px 0` : ""
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    observer.observe(element)
    return () => observer.disconnect()
  }, [say, portrait])
  return (
    <div
      ref={ref}
      className={`guide ${className}`}
      aria-hidden="true"
      style={{ ...GUIDE_BOX, ...style, ...GUIDE_FEET }}
    >
      {img ? (
        <img
          ref={image}
          src={img}
          alt=""
          style={{
            ...GUIDE_IMAGE,
            ...imgStyle,
            top: "auto",
            bottom: GUIDE_IMAGE.bottom,
          }}
        />
      ) : null}
      {children}
      {say ? (
        <div
          ref={bubble}
          className="say"
          style={{
            ...REVERT,
            position: "absolute",
            // 画面の右寄りに立つ人は、吹き出しを左へ出して画面の外へはみ出さない
            ...(flip
              ? { right: portrait ? "40%" : "66%" }
              : { left: portrait ? "40%" : "66%" }),
            top: portrait ? "-24%" : "8%",
            zIndex: 1,
            width: "max-content",
            padding: "0.9em 1.7em 2.6em",
            rotate: "-5deg",
            color: PALETTE.ink,
            fontSize: unit(portrait ? 3.4 : 2.8),
            fontWeight: 900,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            filter:
              "drop-shadow(3px 0 0 #0b0c12) drop-shadow(-3px 0 0 #0b0c12) drop-shadow(0 3px 0 #0b0c12) drop-shadow(0 -3px 0 #0b0c12) drop-shadow(calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0 #6b1723)",
            ...sayStyle,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              ...REVERT,
              position: "absolute",
              inset: 0,
              zIndex: -1,
              background: PALETTE.paper,
              clipPath:
                "polygon(0 12%, 44% 0, 100% 9%, 95% 62%, 58% 72%, 24% 70%, 4% 100%, 12% 68%, 2% 60%)",
            }}
          />
          {say}
        </div>
      ) : null}
    </div>
  )
})

/** 見出しの文字を一字ずつ回しながら叩きつける。 */
export function SlamTitle({
  text,
  left = "5%",
  top = "8%",
  size = 30,
  delay = 0,
  rotate = 0,
}: {
  text: string
  left?: string
  top?: string
  size?: number
  delay?: number
  rotate?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const letters = useRef<(HTMLSpanElement | null)[]>([])
  const leaving = useLeaving()
  const stage = useStage()
  useLayoutEffect(() => {
    for (const [i, s] of letters.current.entries())
      play(
        s,
        [
          {
            opacity: 0,
            transform: `translateY(${i % 2 ? -0.6 : 0.6}em) rotate(${i % 2 ? 30 : -30}deg) scale(3)`,
          },
          { opacity: 1, offset: 0.2 },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: animationTiming.enter,
          delay: delay + letterDelay(i, text.length),
          easing: EASE_POP,
          fill: "both",
        }
      )
    // 入場は一度だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (leaving)
      stage.exits.track(
        play(
          ref.current,
          [
            { transform: "none" },
            { transform: "translateX(-120vw) rotate(-20deg)" },
          ],
          { duration: animationTiming.exit, easing: EASE_IN, fill: "both" }
        )
      )
  }, [leaving])
  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        left,
        top,
        rotate: `${rotate}deg`,
        transformOrigin: "0 100%",
        fontSize: `calc(var(--u)*${size})`,
        lineHeight: 1,
        color: COLOR.mist,
        textShadow: `calc(var(--u)*1.4) calc(var(--u)*1.4) 0 ${COLOR.ink}`,
        pointerEvents: "none",
      }}
    >
      {Array.from(text).map((c, i) => (
        <span
          key={i}
          ref={(element) => {
            letters.current[i] = element
          }}
          style={{
            display: "inline-block",
            rotate: `${[-6, 4, -2, 7, -4][i % 5]}deg`,
            scale: `${[1.1, 0.88, 1, 0.94, 1.06][i % 5]}`,
            translate: `0 ${[0, -0.08, 0.06, -0.04, 0.1][i % 5]}em`,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  )
}

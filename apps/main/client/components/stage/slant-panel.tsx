import { parallel } from "@/client/components/canvas/parallel"
import { useStage } from "@/client/components/stage/use-stage"
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import type { CSSProperties, ReactNode } from "react"
import { motion } from "motion/react"
import { COLOR, EASE_IN, MOTION_EASE } from "@/client/components/stage/kit"
import { seconds } from "@/client/components/stage/seconds"
import { Ransom } from "@/client/components/stage/ransom"
import { FlowingPattern } from "@/client/components/canvas/flowing-pattern"
import { HalftoneDots } from "@/client/components/canvas/halftone-dots"
import { useGoing } from "@/client/components/stage/use-going"
import { play } from "@/client/components/canvas/play"

export type PanelHandle = { close: () => Promise<void> }

/**
 * フェーズが変わったことを示す、画面を覆う斜めの板。トーンが流れ続ける。
 * 見出し（白い札＋擬音）と中身はこの中に置く。
 */
type Props = {
  z?: number
  tone?: string
  inset?: { top: string; bottom: string }
  rotate?: number
  title?: string
  headStyle?: CSSProperties
  headSize?: number
  reveal?: "slant" | "wipe"
  children?: ReactNode
}

export const SlantPanel = forwardRef<
  PanelHandle,
  {
    z?: number
    tone?: string
    inset?: { top: string; bottom: string }
    rotate?: number
    title?: string
    headStyle?: CSSProperties
    headSize?: number
    reveal?: "slant" | "wipe"
    children?: ReactNode
  }
>(function SlantPanel(props: Props, handle) {
  const z = props.z === undefined ? 26 : props.z
  const tone = props.tone === undefined ? COLOR.ink : props.tone
  const inset =
    props.inset === undefined ? { top: "5%", bottom: "30%" } : props.inset
  const rotate = props.rotate === undefined ? -4 : props.rotate
  const headSize = props.headSize === undefined ? 9 : props.headSize
  const reveal = props.reveal === undefined ? "slant" : props.reveal

  const stage = useStage()
  const panel = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const closing = useRef<ReturnType<typeof play> | null>(null)
  const { leaving, mark } = useGoing()
  const open =
    reveal === "slant"
      ? "polygon(0 0, 130% 0, 100% 100%, -30% 100%)"
      : "polygon(0 0, 100% 0, 100% 100%, 0 100%)"
  const shut =
    reveal === "slant"
      ? "polygon(0 0, 0 0, -30% 100%, -30% 100%)"
      : "polygon(0 0, 0 0, 0 100%, 0 100%)"
  const gone = "polygon(130% 0, 130% 0, 100% 100%, 100% 100%)"
  // 順番待ちのある場面（宿・戦利品）は、閉じ終わりを待ってから次へ進む
  const close = () => {
    // ボタンからのcloseとLeavingContextの合図は、同じ退場の完了を待つ。
    // 再生を置き換えると古い待ちが解除され、次の画面へ早送りされてしまう。
    closing.current ??= stage.exits.track(
      play(panel.current, [{ clipPath: open }, { clipPath: gone }], {
        duration: 300,
        easing: EASE_IN,
        fill: "both",
      })
    )
    return closing.current.finished
  }
  useImperativeHandle(handle, () => ({ close }))
  // 退場の合図（AnimatePresence ではなく LeavingContext で下がる場合）
  useEffect(() => {
    if (!leaving) return
    stage.exits.track(
      parallel(() => {
        void close()
        play(
          head.current,
          [
            { opacity: 1 },
            { opacity: 0, transform: "translateX(-90vw) rotate(-20deg)" },
          ],
          { duration: 280, easing: EASE_IN, fill: "both" }
        )
      })
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaving])
  return (
    <div
      data-leaving={mark}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: z,
        pointerEvents: "none",
      }}
    >
      <motion.div
        ref={panel}
        aria-hidden="true"
        initial={{ clipPath: shut }}
        animate={{
          clipPath: open,
          transition: {
            duration: seconds(reveal === "slant" ? 480 : 420),
            ease: MOTION_EASE.out,
          },
        }}
        exit={{
          clipPath: gone,
          transition: { duration: seconds(300), ease: MOTION_EASE.in },
        }}
        style={{
          position: "absolute",
          left: "-12%",
          right: "-12%",
          top: inset.top,
          bottom: inset.bottom,
          rotate: `${rotate}deg`,
          background: tone,
          boxShadow: `0 0 0 calc(var(--u)*.8) ${COLOR.paper}, calc(var(--u)*1.6) calc(var(--u)*1.6) 0 calc(var(--u)*.8) ${COLOR.blood}`,
          overflow: "hidden",
        }}
      >
        <FlowingPattern
          to="60px -36px"
          duration={1600}
          style={{
            position: "absolute",
            inset: "-10%",
            backgroundImage:
              "repeating-linear-gradient(-60deg, rgb(238 235 227 / .07) 0 8px, transparent 8px 22px)",
          }}
        />
        <HalftoneDots
          color="rgb(238 235 227 / .12)"
          fade="linear-gradient(115deg, transparent 50%, #000)"
        />
      </motion.div>
      {props.title ? (
        // 置き場所と傾きは外側（CSS の rotate）、出入りの動きは内側（motion の transform）
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "5%",
            top: "7%",
            rotate: "-8deg",
            whiteSpace: "nowrap",
            ...props.headStyle,
          }}
        >
          <motion.div
            ref={head}
            initial={{ x: "-70vw", rotate: -20 }}
            animate={{
              x: "0vw",
              rotate: 0,
              transition: {
                duration: seconds(500),
                delay: seconds(120),
                ease: MOTION_EASE.out,
              },
            }}
            exit={{
              opacity: 0,
              x: "-90vw",
              rotate: -20,
              transition: { duration: seconds(280), ease: MOTION_EASE.in },
            }}
          >
            <Ransom text={props.title} size={headSize} delay={120} />
          </motion.div>
        </div>
      ) : null}
      {props.children}
    </div>
  )
})

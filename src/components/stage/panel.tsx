import { parallel } from "@/components/canvas/animation"
import { useStage } from "./stage-context"
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react"
import { motion } from "motion/react"
import { COLOR, EASE_IN, MOTION_EASE, seconds } from "@/components/stage/kit"
import { Ransom } from "@/components/stage/ransom"
import { FlowingPattern } from "@/components/canvas/primitives"
import { HalftoneDots } from "@/components/canvas/paper"
import { useGoing } from "@/components/stage/word"
import { play } from "@/components/canvas/play"

export type PanelHandle = { close: () => Promise<void> }

/**
 * フェーズが変わったことを示す、画面を覆う斜めの板。トーンが流れ続ける。
 * 見出し（白い札＋擬音）と中身はこの中に置く。
 */
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
>(function SlantPanel(
  {
    z = 26,
    tone = COLOR.ink,
    inset = { top: "5%", bottom: "30%" },
    rotate = -4,
    title,
    headStyle,
    headSize = 9,
    reveal = "slant",
    children,
  },
  handle
) {
  const stage = useStage()
  const panel = useRef<HTMLDivElement>(null)
  const head = useRef<HTMLDivElement>(null)
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
  const close = async () => {
    await play(panel.current, [{ clipPath: open }, { clipPath: gone }], {
      duration: 300,
      easing: EASE_IN,
      fill: "both",
    }).finished
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
      {title ? (
        // 置き場所と傾きは外側（CSS の rotate）、出入りの動きは内側（motion の transform）
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "5%",
            top: "7%",
            rotate: "-8deg",
            whiteSpace: "nowrap",
            ...headStyle,
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
            <Ransom text={title} size={headSize} delay={120} />
          </motion.div>
        </div>
      ) : null}
      {children}
    </div>
  )
})

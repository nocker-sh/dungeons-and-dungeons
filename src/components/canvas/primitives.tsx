import { forwardRef, type CSSProperties } from "react"
import { motion, type HTMLMotionProps, type SVGMotionProps } from "motion/react"
import { REVERT } from "@/components/canvas/tokens"

/**
 * Canvas の基本部品。どれも最初に `all: revert` を当て、ページ側のCSS（Tailwind のリセットなど）を打ち消してから、
 * 必要な値だけを style で書く。動きは motion の animate / whileHover / whileTap / exit で付ける。
 */
const BOX: CSSProperties = {
  ...REVERT,
  display: "block",
  boxSizing: "border-box",
}

export const CanvasBox = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function CanvasBox({ style, ...props }, ref) {
    return <motion.div ref={ref} style={{ ...BOX, ...style }} {...props} />
  }
)

const TEXT: CSSProperties = { ...REVERT, boxSizing: "border-box" }

export const CanvasText = forwardRef<HTMLSpanElement, HTMLMotionProps<"span">>(
  function CanvasText({ style, ...props }, ref) {
    return <motion.span ref={ref} style={{ ...TEXT, ...style }} {...props} />
  }
)

/** 押せる部品。層（押せない）の中でも押せるように pointerEvents は auto。 */
const BUTTON: CSSProperties = {
  ...REVERT,
  display: "block",
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  border: 0,
  background: "none",
  font: "inherit",
  color: "inherit",
  textAlign: "inherit",
  cursor: "pointer",
  touchAction: "manipulation",
  pointerEvents: "auto",
  WebkitTapHighlightColor: "transparent",
}

export const CanvasButton = forwardRef<
  HTMLButtonElement,
  HTMLMotionProps<"button">
>(function CanvasButton({ style, type = "button", ...props }, ref) {
  return (
    <motion.button
      ref={ref}
      type={type}
      style={{ ...BUTTON, ...style }}
      {...props}
    />
  )
})

const IMAGE: CSSProperties = {
  ...REVERT,
  display: "block",
  maxWidth: "none",
  userSelect: "none",
  WebkitUserDrag: "none",
} as CSSProperties

export const CanvasImage = forwardRef<HTMLImageElement, HTMLMotionProps<"img">>(
  function CanvasImage({ style, alt = "", draggable = false, ...props }, ref) {
    return (
      <motion.img
        ref={ref}
        alt={alt}
        draggable={draggable}
        style={{ ...IMAGE, ...style }}
        {...props}
      />
    )
  }
)

export const CanvasSvg = forwardRef<
  SVGSVGElement,
  SVGMotionProps<SVGSVGElement>
>(function CanvasSvg({ style, ...props }, ref) {
  return (
    <motion.svg
      ref={ref}
      style={{ ...REVERT, display: "block", ...style }}
      {...props}
    />
  )
})

/**
 * 画面いっぱいの層。層そのものは押せず、中の CanvasButton などだけが押せる。
 */
export const CanvasLayer = forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  function CanvasLayer({ style, ...props }, ref) {
    return (
      <motion.div
        ref={ref}
        style={{
          ...BOX,
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          ...style,
        }}
        {...props}
      />
    )
  }
)

/** 背景の模様が流れ続ける飾り（斜線のトーンなど）。to は一周で動く背景の位置。 */
export function FlowingPattern({
  className,
  to,
  duration,
  style,
}: {
  className?: string
  to: string
  duration: number
  style?: CSSProperties
}) {
  return (
    <motion.i
      className={className}
      aria-hidden="true"
      style={{ ...REVERT, backgroundPosition: "0 0", ...style }}
      animate={{ backgroundPosition: ["0 0", to] }}
      transition={{
        duration: duration / 1000,
        ease: "linear",
        repeat: Infinity,
      }}
    />
  )
}

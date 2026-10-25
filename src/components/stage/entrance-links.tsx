import { useId, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  CanvasBox,
  CanvasButton,
  CanvasSvg,
  CanvasText,
} from "@/components/canvas/primitives"
import { FONT_FAMILY, PALETTE } from "@/components/canvas/tokens"
import { useActiveMark, usePointerState } from "@/components/canvas/state"
import { animationTiming } from "./timing"
import { useStage } from "./stage-context"
import { useGoing, wordLetterScales } from "./word"
import { focusMove } from "./focus-zoom"
import type { Move } from "@/components/game/nav"

export type EntranceLink = {
  id: string
  label: string
  lines?: readonly string[]
  /** 背景画像の左上を0、右下を1とした入口の位置。 */
  anchor: readonly [number, number]
  primary?: boolean
  disabled?: boolean
  /** move は背景のこの入口へ寄る切り替え方。nav.go にそのまま渡す。 */
  onClick: (move: Move) => void
}

type ArtworkGeometry = {
  width: number
  height: number
  left: number
  top: number
  visibleLeft: number
  visibleTop: number
  viewportWidth: number
  viewportHeight: number
}

/** object-fit: cover と同じ画像座標の面を、背景のカメラ層に重ねる。 */
export function EntranceLinks({
  links,
  wide,
}: {
  links: readonly EntranceLink[]
  wide: boolean
}) {
  const { artboard, canvas } = useStage()
  const [geometry, setGeometry] = useState<ArtworkGeometry | null>(null)
  useLayoutEffect(() => {
    setGeometry(null)
    const image = artboard?.querySelector("img")
    const viewport = canvas.current
    if (!artboard || !image || !viewport) return
    const measure = () => {
      if (!image.naturalWidth || !image.naturalHeight) return
      const scale = Math.max(
        artboard.clientWidth / image.naturalWidth,
        artboard.clientHeight / image.naturalHeight
      )
      const width = image.naturalWidth * scale
      const height = image.naturalHeight * scale
      const left = (artboard.clientWidth - width) / 2
      const top = (artboard.clientHeight - height) / 2
      setGeometry({
        width,
        height,
        left,
        top,
        visibleLeft: (artboard.clientWidth - viewport.clientWidth) / 2 - left,
        visibleTop: (artboard.clientHeight - viewport.clientHeight) / 2 - top,
        viewportWidth: viewport.clientWidth,
        viewportHeight: viewport.clientHeight,
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(artboard)
    observer.observe(viewport)
    image.addEventListener("load", measure)
    measure()
    return () => {
      observer.disconnect()
      image.removeEventListener("load", measure)
    }
  }, [artboard, canvas])
  if (!artboard || !geometry) return null
  return createPortal(
    <CanvasBox
      data-entrance-links
      style={{
        position: "absolute",
        left: geometry.left,
        top: geometry.top,
        width: geometry.width,
        height: geometry.height,
        pointerEvents: "none",
      }}
    >
      {links.map((link, index) => (
        <EntranceBubble
          key={link.id}
          link={link}
          geometry={geometry}
          wide={wide}
          index={index}
        />
      ))}
    </CanvasBox>,
    artboard
  )
}

function EntranceBubble({
  link,
  geometry,
  wide,
  index,
}: {
  link: EntranceLink
  geometry: ArtworkGeometry
  wide: boolean
  index: number
}) {
  const reference = useRef<HTMLButtonElement>(null)
  const dots = useId()
  const active = useActiveMark(reference)
  const pointer = usePointerState()
  const stage = useStage()
  const { leaving, going, mark, completion } = useGoing()
  const anchorX = link.anchor[0] * geometry.width
  const anchorY = link.anchor[1] * geometry.height
  const lines = link.lines ?? [link.label]
  const letterScale = (index: number) =>
    index === 0 ? 1.22 : wordLetterScales[index % wordLetterScales.length]
  const letteringWidth = Math.max(
    ...lines.map((line) =>
      Array.from(line).reduce(
        (width, _, index) => width + letterScale(index),
        0
      )
    )
  )
  const desiredFontSize = wide
    ? Math.min(44, Math.max(26, geometry.viewportWidth * 0.034))
    : Math.min(34, Math.max(24, geometry.viewportWidth * 0.077))
  const width = Math.min(
    geometry.viewportWidth * (wide ? 0.22 : 0.45),
    Math.max(76, desiredFontSize * (letteringWidth + 0.8))
  )
  const fontSize = Math.min(desiredFontSize, (width - 16) / letteringWidth)
  const center = Math.max(
    geometry.visibleLeft + width / 2 + 22,
    Math.min(
      anchorX,
      geometry.visibleLeft + geometry.viewportWidth - width / 2 - 22
    )
  )
  const left = center - width / 2
  const bodyHeight = lines.length > 1 ? fontSize * 2.65 : fontSize * 1.8
  const tailHeight = wide ? 54 : 34
  const top = Math.max(
    geometry.visibleTop + 38,
    anchorY - bodyHeight - tailHeight
  )
  const height = anchorY - top
  const tailX = anchorX - left
  const tailBase = Math.max(30, Math.min(tailX, width - 30))
  const shape = `M 6 10 L ${width * 0.58} 3 L ${width - 6} 0 L ${width - 1} ${bodyHeight - 8} L ${tailBase + 13} ${bodyHeight - 3} L ${tailX} ${height} L ${tailBase - 10} ${bodyHeight - 2} L 0 ${bodyHeight + 4} Z`
  const highlighted = active || pointer.hover
  const fill = link.primary
    ? PALETTE.paper
    : highlighted
      ? PALETTE.blood
      : PALETTE.ink
  const textColor = link.primary ? PALETTE.ink : PALETTE.paper
  const textStroke = link.primary ? PALETTE.paper : PALETTE.ink
  const shadow = link.primary ? PALETTE.blood : PALETTE.paper
  return (
    <CanvasButton
      ref={reference}
      className={`word entrance-bubble${link.primary ? " cta" : ""}`}
      data-entrance={link.id}
      data-anchor-x={link.anchor[0]}
      data-anchor-y={link.anchor[1]}
      data-leaving={mark}
      aria-label={link.label}
      disabled={going || link.disabled}
      onClick={() => {
        if (going || link.disabled) return
        link.onClick(
          focusMove(stage, {
            layer: { x: geometry.left + anchorX, y: geometry.top + anchorY },
          })
        )
      }}
      {...pointer.handlers}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={
        leaving
          ? { opacity: 0, scale: 0.85 }
          : { opacity: link.disabled ? 0.38 : 1, scale: 1 }
      }
      transition={{
        duration:
          (leaving ? animationTiming.exit : animationTiming.enter) / 1000,
        delay: leaving ? 0 : index * 0.06,
      }}
      {...completion}
      whileTap={going ? undefined : { scale: 0.96 }}
      style={{
        position: "absolute",
        left,
        top,
        width,
        height,
        transformOrigin: `${tailX}px ${height}px`,
        color: textColor,
        fontFamily: FONT_FAMILY,
        fontWeight: 900,
        lineHeight: 1.13,
        outlineOffset: 5,
        overflow: "visible",
      }}
    >
      <CanvasSvg
        aria-hidden="true"
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          pointerEvents: "none",
        }}
      >
        <defs>
          <pattern id={dots} width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.4" fill={textColor} opacity=".18" />
          </pattern>
        </defs>
        <path
          d={shape}
          fill={shadow}
          stroke={PALETTE.ink}
          strokeWidth={4}
          transform="translate(5 6)"
        />
        <path
          d={shape}
          fill={fill}
          stroke={PALETTE.ink}
          strokeWidth={2}
          strokeLinejoin="miter"
        />
        <path d={shape} fill={`url(#${dots})`} />
        <circle
          data-entrance-tip
          cx={tailX}
          cy={height}
          r="1"
          fill="transparent"
        />
      </CanvasSvg>
      <CanvasText
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 6,
          right: 6,
          top: -2,
          height: bodyHeight - 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          font: "inherit",
          fontSize,
          letterSpacing: "-.04em",
          rotate: index % 2 ? "3deg" : "-4deg",
          paintOrder: "stroke fill",
          WebkitTextStroke: `.075em ${textStroke}`,
          pointerEvents: "none",
        }}
      >
        {lines.map((line) => (
          <CanvasText
            key={line}
            style={{
              font: "inherit",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "flex-end",
            }}
          >
            {Array.from(line).map((letter, index) => (
              <CanvasText
                key={index}
                style={{
                  font: "inherit",
                  display: "inline-block",
                  fontSize: `${letterScale(index)}em`,
                  translate: `0 ${((index % 3) - 1) * 0.05}em`,
                  rotate: `${index % 2 ? 3 : -3}deg`,
                }}
              >
                <CanvasText
                  style={{ font: "inherit", display: "inline-block" }}
                  initial={{ opacity: 0, y: index % 2 ? -12 : 12, scale: 2.4 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: animationTiming.letter / 1000,
                    delay: index * 0.03,
                  }}
                >
                  {letter}
                </CanvasText>
              </CanvasText>
            ))}
          </CanvasText>
        ))}
      </CanvasText>
    </CanvasButton>
  )
}

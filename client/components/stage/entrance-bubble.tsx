import { useId, useRef } from "react"
import { CanvasButton } from "@/client/components/canvas/canvas-button"
import { CanvasSvg } from "@/client/components/canvas/canvas-svg"
import { CanvasText } from "@/client/components/canvas/canvas-text"
import { FONT_FAMILY, PALETTE } from "@/client/components/canvas/tokens"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { usePointerState } from "@/client/components/canvas/use-pointer-state"
import { animationTiming } from "@/client/components/stage/timing"
import { useStage } from "@/client/components/stage/use-stage"
import { useGoing } from "@/client/components/stage/use-going"
import { wordLetterScales } from "@/client/components/stage/word"
import { focusMove } from "@/client/components/stage/focus-move"
import type {
  EntranceLink,
  ArtworkGeometry,
} from "@/client/components/stage/entrance-links-shared"

type Props = {
  link: EntranceLink
  geometry: ArtworkGeometry
  wide: boolean
  index: number
}

export function EntranceBubble(props: Props) {
  const reference = useRef<HTMLButtonElement>(null)
  const dots = useId()
  const active = useActiveMark(reference)
  const pointer = usePointerState()
  const stage = useStage()
  const { leaving, going, mark, completion } = useGoing()
  const anchorX = props.link.anchor[0] * props.geometry.width
  const anchorY = props.link.anchor[1] * props.geometry.height
  const lines = props.link.lines ?? [props.link.label]
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
  const desiredFontSize = props.wide
    ? Math.min(44, Math.max(26, props.geometry.viewportWidth * 0.034))
    : Math.min(34, Math.max(24, props.geometry.viewportWidth * 0.077))
  const width = Math.min(
    props.geometry.viewportWidth * (props.wide ? 0.22 : 0.45),
    Math.max(76, desiredFontSize * (letteringWidth + 0.8))
  )
  const fontSize = Math.min(desiredFontSize, (width - 16) / letteringWidth)
  const center = Math.max(
    props.geometry.visibleLeft + width / 2 + 22,
    Math.min(
      anchorX,
      props.geometry.visibleLeft + props.geometry.viewportWidth - width / 2 - 22
    )
  )
  const left = center - width / 2
  const bodyHeight = lines.length > 1 ? fontSize * 2.65 : fontSize * 1.8
  const tailHeight = props.wide ? 54 : 34
  const top = Math.max(
    props.geometry.visibleTop + 38,
    anchorY - bodyHeight - tailHeight
  )
  const height = anchorY - top
  const tailX = anchorX - left
  const tailBase = Math.max(30, Math.min(tailX, width - 30))
  const shape = `M 6 10 L ${width * 0.58} 3 L ${width - 6} 0 L ${width - 1} ${bodyHeight - 8} L ${tailBase + 13} ${bodyHeight - 3} L ${tailX} ${height} L ${tailBase - 10} ${bodyHeight - 2} L 0 ${bodyHeight + 4} Z`
  const highlighted = active || pointer.hover
  const fill = props.link.primary
    ? PALETTE.paper
    : highlighted
      ? PALETTE.blood
      : PALETTE.ink
  const textColor = props.link.primary ? PALETTE.ink : PALETTE.paper
  const textStroke = props.link.primary ? PALETTE.paper : PALETTE.ink
  const shadow = props.link.primary ? PALETTE.blood : PALETTE.paper
  return (
    <CanvasButton
      ref={reference}
      className={`word entrance-bubble${props.link.primary ? " cta" : ""}`}
      data-entrance={props.link.id}
      data-anchor-x={props.link.anchor[0]}
      data-anchor-y={props.link.anchor[1]}
      data-leaving={mark}
      aria-label={props.link.label}
      disabled={going || props.link.disabled}
      onClick={() => {
        if (going || props.link.disabled) return
        props.link.onClick(
          focusMove(stage, {
            layer: {
              x: props.geometry.left + anchorX,
              y: props.geometry.top + anchorY,
            },
          })
        )
      }}
      {...pointer.handlers}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={
        leaving
          ? { opacity: 0, scale: 0.85 }
          : { opacity: props.link.disabled ? 0.38 : 1, scale: 1 }
      }
      transition={{
        duration:
          (leaving ? animationTiming.exit : animationTiming.enter) / 1000,
        delay: leaving ? 0 : props.index * 0.06,
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
          rotate: props.index % 2 ? "3deg" : "-4deg",
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

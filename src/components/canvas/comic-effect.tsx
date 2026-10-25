import { useReducedMotion } from "motion/react"
import { useLayoutEffect, useRef } from "react"
import { AnimationScope } from "@/components/canvas/animation"
import { play } from "@/components/canvas/play"
import { reportAnimationError } from "@/components/canvas/use-animation"
import {
  CanvasBox,
  CanvasImage,
  CanvasText,
} from "@/components/canvas/primitives"
import { COMIC } from "@/components/canvas/tokens"
import effectData from "@/lib/concept/data/effects.json"

const textSegments = new Intl.Segmenter("ja", { granularity: "grapheme" })

const letterPoses = [
  { scale: 1.26, angle: -12, rise: -0.02, width: 0.96 },
  { scale: 0.84, angle: 9, rise: 0.08, width: 1.02 },
  { scale: 1.16, angle: -6, rise: -0.04, width: 1 },
  { scale: 0.94, angle: 7, rise: 0.05, width: 0.96 },
  { scale: 1.2, angle: -9, rise: -0.07, width: 1 },
  { scale: 0.88, angle: 6, rise: 0.06, width: 1.04 },
]
const punctuationPose = { scale: 1.48, angle: 13, rise: -0.04, width: 0.86 }

const movements = {
  "comic-hit": {
    duration: 0.62,
    scale: [0.2, 1.16, 0.96, 1, 0.75],
    rotate: [-18, 5, -3, 0, 6],
    x: [0, 0, 0, 0, 0],
    y: [0, 0, 0, 0, 0],
  },
  "comic-slash": {
    duration: 0.46,
    scale: [0.7, 1.08, 1, 1, 1.04],
    rotate: [-8, 0, 0, 0, 0],
    x: [-32, 2, 0, 0, 12],
    y: [32, -2, 0, 0, -12],
  },
  "comic-critical": {
    duration: 0.76,
    scale: [0.15, 1.2, 0.96, 1.05, 1.12],
    rotate: [-12, 4, -2, 0, 3],
    x: [0, 0, 0, 0, 0],
    y: [0, 0, 0, 0, 0],
  },
  "comic-thrust": {
    duration: 0.42,
    scale: [0.65, 1.08, 1, 1, 1.04],
    rotate: [0, 0, 0, 0, 0],
    x: [-48, 6, 0, 0, 18],
    y: [0, 0, 0, 0, 0],
  },
  "comic-shot": {
    duration: 0.48,
    scale: [0.3, 1.16, 0.94, 1, 0.85],
    rotate: [-6, 3, -2, 0, 2],
    x: [-24, 3, 0, 0, 6],
    y: [0, 0, 0, 0, 0],
  },
  "comic-magic": {
    duration: 0.64,
    scale: [0.3, 1.1, 0.94, 1.05, 1.12],
    rotate: [-16, 3, -2, 0, 8],
    x: [0, 0, 0, 0, 0],
    y: [0, 0, 0, 0, 0],
  },
  "comic-guard": {
    duration: 0.62,
    scale: [0.75, 1.06, 0.98, 1, 1],
    rotate: [0, -4, 2, 0, 0],
    x: [0, -5, 3, 0, 0],
    y: [0, 0, 0, 0, 0],
  },
  "comic-armor-break": {
    duration: 0.7,
    scale: [0.45, 0.95, 1, 1.1, 1.2],
    rotate: [-4, 0, 3, 7, 12],
    x: [0, 0, 0, 0, 0],
    y: [-6, -4, 0, 8, 20],
  },
  "comic-repair": {
    duration: 0.72,
    scale: [1.18, 1.08, 0.94, 1, 1.02],
    rotate: [-8, -3, 2, 0, 0],
    x: [0, 0, 0, 0, 0],
    y: [12, 4, 0, 0, -4],
  },
  "comic-heal": {
    duration: 0.82,
    scale: [0.65, 0.9, 1, 1.03, 1.06],
    rotate: [0, 0, 0, 0, 0],
    x: [0, 0, 0, 0, 0],
    y: [28, 10, 0, -4, -18],
  },
  "comic-regen": {
    duration: 0.9,
    scale: [0.75, 0.94, 1, 1.04, 1.08],
    rotate: [-12, -6, 0, 4, 10],
    x: [0, 0, 0, 0, 0],
    y: [20, 8, 0, -5, -20],
  },
  "comic-purify": {
    duration: 0.72,
    scale: [0.2, 0.92, 1, 1.06, 1.18],
    rotate: [-4, 0, 0, 0, 3],
    x: [0, 0, 0, 0, 0],
    y: [0, 0, 0, 0, 0],
  },
  "comic-revive": {
    duration: 0.86,
    scale: [0.4, 0.9, 1.06, 1, 1.05],
    rotate: [0, 0, 0, 0, 0],
    x: [0, 0, 0, 0, 0],
    y: [36, 12, 0, -4, -24],
  },
  "comic-poison": {
    duration: 0.88,
    scale: [0.6, 0.9, 1.03, 0.99, 1.14],
    rotate: [-8, -3, 2, -2, 6],
    x: [0, -2, 2, -2, 4],
    y: [10, 4, 0, -4, -12],
  },
  "comic-bind": {
    duration: 0.66,
    scale: [1.2, 0.96, 1.04, 1, 0.92],
    rotate: [-10, 3, -2, 0, 0],
    x: [0, 0, 0, 0, 0],
    y: [0, 0, 0, 0, 0],
  },
  "comic-charge": {
    duration: 0.76,
    scale: [0.6, 0.94, 1.06, 1, 1.12],
    rotate: [0, -2, 2, -1, 0],
    x: [0, -2, 2, 0, 0],
    y: [24, 8, 0, -4, -18],
  },
}

export type ComicEffectId = keyof typeof movements

/** 画像・名前は実行用データ、動きはCanvasで管理する。 */
export const comicEffects = effectData.map((effect) => {
  if (!(effect.id in movements))
    throw new Error(`エフェクトの動きがありません: ${effect.id}`)
  return { ...effect, id: effect.id as ComicEffectId }
})

export function ComicEffect({
  effect,
  text = "",
  still = false,
  repeat = false,
  delay = 0,
  width = "76%",
  onComplete,
}: {
  effect: (typeof comicEffects)[number]
  text?: string
  still?: boolean
  repeat?: boolean
  /** 戦闘の複数対象など、開始をずらす時間。ms。 */
  delay?: number
  width?: string | number
  onComplete?: () => void
}) {
  const reducedMotion = useReducedMotion()
  const reference = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (still) return
    const { duration, ...movement } = movements[effect.id]
    const scope = new AnimationScope()
    const cycle = duration * 1000 + (repeat ? 900 : 0)
    const times = [0, 0.14, 0.3, 0.7, 1]
    const frames = times.map((time, index) => ({
      offset: (time * duration * 1000) / cycle,
      opacity: index === 0 || index === 4 ? 0 : 1,
      transform: reducedMotion
        ? "none"
        : `translate(${movement.x[index]}px, ${movement.y[index]}px) rotate(${movement.rotate[index]}deg) scale(${movement.scale[index]})`,
    }))
    if (repeat) frames.push({ ...frames[4], offset: 1 })
    const animation = scope.capture(() =>
      play(reference.current, frames, {
        duration: cycle,
        delay,
        easing: "ease-out",
        iterations: repeat ? Infinity : 1,
        fill: "both",
      })
    )
    if (!repeat)
      void animation.finished
        .then(() => {
          if (!scope.signal.aborted && animation.state === "completed")
            onComplete?.()
        })
        .catch(reportAnimationError)
    return scope.cancel
  }, [effect.id, still, repeat, delay, reducedMotion, onComplete])
  const letters = Array.from(
    textSegments.segment(text),
    ({ segment }, index) => ({
      character: segment,
      pose: /^[!?！？]$/.test(segment)
        ? punctuationPose
        : letterPoses[index % letterPoses.length],
    })
  )
  const textWidth = letters.reduce(
    (width, { character, pose }) =>
      width + (/^[\u0020-\u007e]$/.test(character) ? 0.68 : 1.05) * pose.scale,
    0
  )
  return (
    <CanvasBox
      key={still ? "still" : "playing"}
      ref={reference}
      data-comic-effect={effect.id}
      style={{
        position: "relative",
        width,
        opacity: still ? 1 : 0,
        aspectRatio: "1",
        containerType: "inline-size",
      }}
    >
      <CanvasImage
        src={effect.image}
        alt={`${effect.name} effect`}
        width={1254}
        height={1254}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
      {text && (
        <CanvasText
          data-comic-text
          role="img"
          aria-label={text}
          style={{
            ...COMIC,
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: `${Math.min(24, 76 / Math.max(1, textWidth))}cqw`,
            rotate: "-8deg",
            pointerEvents: "none",
          }}
        >
          {letters.map(({ character, pose }, index) => (
            <CanvasText
              key={index}
              aria-hidden="true"
              data-comic-letter
              style={{
                ...COMIC,
                display: "inline-block",
                flexShrink: 0,
                fontSize: `${pose.scale}em`,
                marginLeft: index ? "-0.04em" : 0,
                transform: `translateY(${pose.rise}em) rotate(${pose.angle}deg) scaleX(${pose.width})`,
              }}
            >
              {character}
            </CanvasText>
          ))}
        </CanvasText>
      )}
    </CanvasBox>
  )
}

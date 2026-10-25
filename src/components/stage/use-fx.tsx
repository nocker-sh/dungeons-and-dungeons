import { useAnimationScope } from "@/components/canvas/use-animation"
import type { FxStore } from "@/components/stage/fx/store"
import { useMemo } from "react"
import {
  ComicEffect,
  comicEffects,
  type ComicEffectId,
} from "@/components/canvas/comic-effect"
import { CanvasBox } from "@/components/canvas/primitives"
import {
  Blades,
  Burst,
  CutIn,
  DamageAt,
  Flash,
  FocusLines,
  NumberAt,
  Shards,
  Slash,
  SpecialCutIn,
} from "@/components/stage/fx"
import { COLOR, unitPx, centerOf } from "@/components/stage/kit"
import { useStage } from "@/components/stage/stage-context"
import { play } from "@/components/canvas/play"

type BurstOptions = {
  fill?: string
  ink?: string
  delay?: number
  spin?: number
  hold?: number
}

/** 画面へ一度きりのエフェクトを出す。位置は view 基準の px。 */
export function useFx() {
  const stage = useStage()
  const lifetime = useAnimationScope()
  return useMemo(() => {
    const view = () => stage.canvas.current
    const store = stage.fxStore
    const add = (render: Parameters<FxStore["add"]>[0]) =>
      lifetime.current.add(store.add(render))
    const size = () => ({
      width: view()?.clientWidth ?? innerWidth,
      height: view()?.clientHeight ?? innerHeight,
    })
    const fx = {
      size,
      center: (el: Element | null, fy = 0.5) => centerOf(el, view(), fy),
      shake(power = 1) {
        const p = power * unitPx()
        return lifetime.current.capture(() =>
          play(
            view(),
            [
              { translate: "0 0" },
              { translate: `${-2.2 * p}px ${1.4 * p}px` },
              { translate: `${1.8 * p}px ${-1.2 * p}px` },
              { translate: `${-1 * p}px ${0.6 * p}px` },
              { translate: "0 0" },
            ],
            { duration: 380, easing: "linear" }
          )
        )
      },
      /** 一瞬止めて、画面ごとグッと寄せる。 */
      hitStop(power = 1) {
        return lifetime.current.capture(() =>
          play(
            view(),
            [
              { scale: 1 },
              { scale: 1 + 0.035 * power, offset: 0.15 },
              { scale: 1 + 0.035 * power, offset: 0.45 },
              { scale: 1 },
            ],
            {
              duration: 260,
              easing: "cubic-bezier(.16,1,.3,1)",
            }
          )
        )
      },
      flash(color: string = COLOR.mist, strength = 0.6) {
        return add((done) => (
          <Flash color={color} strength={strength} done={done} />
        ))
      },
      burst(
        x: number,
        y: number,
        s: number,
        text = "",
        options: BurstOptions = {}
      ) {
        return add((done) => (
          <Burst x={x} y={y} size={s} text={text} {...options} done={done} />
        ))
      },
      /** プレビューと同じ画像・文字・動き。完了と中断も戦闘の待ち合わせに含む。 */
      comic(
        id: ComicEffectId,
        x: number,
        y: number,
        requestedSize: number,
        options: { text?: string; delay?: number } = {}
      ) {
        const effect = comicEffects.find((entry) => entry.id === id)!
        const bounds = size()
        const diameter = Math.min(
          Math.max(requestedSize, 140),
          bounds.width * 0.7,
          bounds.height * 0.55
        )
        const margin = diameter * 0.62 + 24
        const centerX = Math.max(margin, Math.min(x, bounds.width - margin))
        const centerY = Math.max(margin, Math.min(y, bounds.height - margin))
        return add((done) => (
          <CanvasBox
            data-battle-effect={id}
            style={{
              position: "absolute",
              left: centerX - diameter / 2,
              top: centerY - diameter / 2,
              width: diameter,
              height: diameter,
              zIndex: 40,
              pointerEvents: "none",
            }}
          >
            <ComicEffect
              effect={effect}
              width="100%"
              text={options.text ?? effect.sound}
              delay={options.delay}
              onComplete={done}
            />
          </CanvasBox>
        ))
      },
      focusLines(
        cx: number,
        cy: number,
        options: {
          dur?: number
          color?: string
          delay?: number
          count?: number
        } = {}
      ) {
        const { width, height } = size()
        return add((done) => (
          <FocusLines
            cx={cx}
            cy={cy}
            width={width}
            height={height}
            {...options}
            done={done}
          />
        ))
      },
      shards(
        x: number,
        y: number,
        options: {
          n?: number
          colors?: readonly string[]
          power?: number
          delay?: number
        } = {}
      ) {
        return add((done) => <Shards x={x} y={y} {...options} done={done} />)
      },
      numberAt(
        x: number,
        y: number,
        text: string,
        options: { size?: number; color?: string; delay?: number } = {}
      ) {
        return add((done) => (
          <NumberAt x={x} y={y} text={text} {...options} done={done} />
        ))
      },
      damageAt(
        x: number,
        y: number,
        value: number,
        options: {
          big?: boolean
          delay?: number
          to?: { x: number; y: number }
        } = {}
      ) {
        return add((done) => (
          <DamageAt x={x} y={y} value={value} {...options} done={done} />
        ))
      },
      slash(x: number, y: number, s: number, delay = 0) {
        return add((done) => (
          <Slash x={x} y={y} size={s} delay={delay} done={done} />
        ))
      },
      cutIn(text: string, options: { delay?: number; hold?: number } = {}) {
        return add((done) => (
          <CutIn
            text={text}
            {...options}
            onStop={() => fx.shake(0.8)}
            done={done}
          />
        ))
      },
      /** 黒帯で閉じる。closed の後で景色を差し替え、open() を呼ぶと開く。 */
      blades(glow: string) {
        let open!: () => void
        let closed!: () => void
        let finished!: () => void
        const openPromise = new Promise<void>((resolve) => (open = resolve))
        const closedPromise = new Promise<void>((resolve) => (closed = resolve))
        const done = new Promise<void>((resolve) => (finished = resolve))
        // 景色を差し替える側は閉じた時点まで待つ。全体はStageが所有し、次の画面で開く。
        const effect = store.add(
          (remove) => (
            <Blades
              glow={glow}
              closed={closed}
              open={openPromise}
              done={() => {
                remove()
                finished()
              }}
            />
          ),
          { collect: false }
        )
        void effect.finished.then(() => {
          closed()
          open()
          finished()
        })
        return { closed: closedPromise, open, done }
      },
      special(
        img: string,
        fxRatio: number,
        name: string,
        wide: boolean,
        merge?: string
      ) {
        fx.shake(0.6)
        return add((done) => (
          <SpecialCutIn
            img={img}
            fx={fxRatio}
            name={name}
            wide={wide}
            merge={merge}
            done={done}
          />
        ))
      },
    }
    return fx
  }, [stage, lifetime])
}

export type Fx = ReturnType<typeof useFx>

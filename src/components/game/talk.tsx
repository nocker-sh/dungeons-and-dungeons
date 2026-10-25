import {
  useAnimationScope,
  reportAnimationError,
} from "@/components/canvas/use-animation"
import { tween } from "@/components/canvas/animation"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "motion/react"
import { steps } from "motion"
import { COLOR, MOTION_EASE, seconds } from "@/components/stage/kit"
import { useStage } from "@/components/stage/stage-context"
import { useTakeover } from "@/components/stage/takeover"
import { Word, useWide, useWideFormation } from "@/components/stage/word"
import { BUTTON_BASE, PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { play, type Played } from "@/components/canvas/play"
import { TornLabel, TornPlate } from "@/components/canvas/paper"

/** セリフ枠と立ち絵が共有する、画面全体を基準にした境界。 */
export function conversationBoxHeight(wideFormation: boolean) {
  // 2行のセリフが入る高さ。高すぎると文の上下が空く
  return wideFormation ? "16vh" : "16vh"
}

/** name は話し手の名前。立ち絵の枠に人が入れ替わる会話で、枠の持ち主の名前より優先する。 */
export type Line = readonly [speaker: number, text: string, name?: string]
export type Script = {
  lines: readonly Line[]
  choice?: {
    ask: string
    options: readonly (readonly [label: string, lines: readonly Line[]])[]
  }
}
export type Actor = {
  /** 立ち絵の枠（中央へ寄せる・前後を入れ替える）。 */
  el: HTMLElement | null
  /** 立ち絵の絵（話している方を明るく前に出す）。持ち主から預かる。 */
  image?: HTMLElement | null
  /** 立ち絵の吹き出し（会話の間は隠す）。持ち主から預かる。 */
  bubble?: HTMLElement | null
  name?: string
}

/** 押すと全文、もう一度押すと次へ。 */
function useTyping(text: string) {
  // 何文字出したかは、どのセリフの分かと組で持つ。セリフが替わった最初の描画で、
  // 前のセリフの文字数のまま新しいセリフを一瞬出さないため
  const [typed, setTyped] = useState({ text, count: 0 })
  const shown = typed.text === text ? typed.count : 0
  const [revealed, setRevealed] = useState<string | null>(null)
  useEffect(() => {
    setTyped({ text, count: 0 })
    const animation = tween(0, text.length, text.length * 26, (value) =>
      setTyped({ text, count: Math.floor(value) })
    )
    return animation.cancel
  }, [text])
  return {
    shown: revealed === text ? text : text.slice(0, shown),
    done: revealed === text || shown >= text.length,
    finish: () => setRevealed(text),
  }
}

/**
 * 会話：隊列（Formation）を下げ、下に文章の窓を出す。話し手（立ち絵）は画面の中央へ寄り、話している方が明るく前に出る。
 * 選択肢があれば右からリボルバー。選んだ番号を onDone に返す（選択肢がなければ -1）。
 */
export function Conversation({
  actors,
  script,
  onDone,
  after,
  onLine,
  initialLine = 0,
  onOpened,
  label = "会話",
}: {
  actors: readonly Actor[]
  script: Script
  onDone: (picked: number) => void
  onOpened?: () => Promise<void>
  initialLine?: number
  /** picked は選んだ答えの番号（選ぶ前は -1）。index はその答えの返事の中の位置。 */
  onLine?: (index: number, picked: number) => void
  after?: (picked: number) => Promise<void>
  label?: string
}) {
  const stage = useStage()
  // 会話の間は隊列を下げ、戻るを引っ込める
  useTakeover("conversation")
  const wide = useWide()
  const wideFormation = useWideFormation()
  const [queue, setQueue] = useState<readonly Line[]>(script.lines)
  const [index, setIndex] = useState(initialLine)
  const [asking, setAsking] = useState(false)
  const [picked, setPicked] = useState(-1)
  // 窓を閉じ始めたら、外へ滑り終わってから onDone へ渡す結果
  const [closing, setClosing] = useState<number | null>(null)
  const lifetime = useAnimationScope()
  const ending = useRef(false)
  const [opening, setOpening] = useState(Boolean(onOpened))
  const opened = useRef(false)
  const moves = useRef<Played[]>([])
  const dialog = useRef<HTMLDivElement>(null)
  const talkButton = useRef<HTMLButtonElement>(null)
  const firstOption = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const line = queue[index]
  // 返事を選ぶ間も、何に対する返事か分かるよう最後のセリフを窓に残す
  const typing = useTyping(line?.[1] ?? "")

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    const focused = document.activeElement
    if (focused instanceof HTMLElement && !element.contains(focused))
      previousFocus.current = focused
    talkButton.current?.focus({ preventScroll: true })
    return () => {
      queueMicrotask(() => {
        if (!element.isConnected && previousFocus.current?.isConnected)
          previousFocus.current.focus({ preventScroll: true })
      })
    }
  }, [])

  useLayoutEffect(() => {
    if (!asking) talkButton.current?.focus({ preventScroll: true })
    else firstOption.current?.focus({ preventScroll: true })
  }, [asking])

  /**
   * 立ち絵の寄せ先。横は枠の幅に対する割合で返す。
   * 動かしている変形に左右されないよう、配置の値（offsetLeft・offsetWidth）で測る。
   */
  const placement = (index: number, wideScreen: boolean) => {
    const el = actors[index]?.el
    const width = (el?.offsetParent as HTMLElement | null)?.clientWidth ?? 0
    let offset = 0
    if (el && width && el.offsetWidth) {
      // 両端の立ち絵の間隔。2人は左右へ離し、3人はさらに広げて均等に並べる
      const span =
        width *
        (actors.length > 2
          ? wideScreen
            ? 0.56
            : 0.64
          : wideScreen
            ? 0.44
            : 0.56)
      const target =
        width / 2 +
        (actors.length > 1 ? (index / (actors.length - 1) - 0.5) * span : 0)
      offset =
        ((target - (el.offsetLeft + el.offsetWidth / 2)) / el.offsetWidth) * 100
    }
    return {
      translate: `${offset}% ${wideScreen ? "2%" : "0"}`,
      // 縦長は寄って大きく見せる
      scale: wideScreen ? 1 : 1.25,
    }
  }

  // 立ち絵を中央へ。窓を下から出す
  useLayoutEffect(() => {
    moves.current = actors.flatMap((actor, i) => {
      const el = actor.el
      if (!el) return []
      el.style.transformOrigin = "50% 100%"
      return [
        play(el, [{ translate: "0 0", scale: 1 }, placement(i, wide)], {
          duration: 620,
          delay: 120,
          easing: "cubic-bezier(.34,1.3,.64,1)",
          fill: "both",
          id: "talk-move",
        }),
      ]
    })
    for (const actor of actors)
      if (actor.bubble) actor.bubble.style.visibility = "hidden"
    return () => {
      // 立ち絵を元の位置へ戻す
      for (const actor of actors)
        play(actor.el, [{ translate: "0 0", scale: 1 }], {
          duration: 420,
          easing: "cubic-bezier(.34,1.3,.64,1)",
        })
      for (const actor of actors) {
        if (actor.image) actor.image.style.filter = ""
        if (actor.el) actor.el.style.zIndex = ""
        if (actor.bubble) actor.bubble.style.visibility = ""
      }
    }
    // 始まりと終わりだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 会話の途中で縦長と横長が入れ替わったら、寄せ方と間隔を今の画面に合わせ直す
  const placedWide = useRef(wide)
  useLayoutEffect(() => {
    if (placedWide.current === wide) return
    placedWide.current = wide
    moves.current = actors.flatMap((actor, i) =>
      actor.el
        ? [
            play(
              actor.el,
              [
                {
                  translate: getComputedStyle(actor.el).translate,
                  scale: getComputedStyle(actor.el).scale,
                },
                placement(i, wide),
              ],
              {
                duration: 240,
                easing: "cubic-bezier(.16,1,.3,1)",
                fill: "both",
                id: "talk-move",
              }
            ),
          ]
        : []
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wide])

  // 話している方を明るく前に
  useEffect(() => {
    onLine?.(index, picked)
    const speaker = line?.[0] ?? -1
    for (const [k, actor] of [...actors].entries()) {
      const img = actor.image
      if (img)
        img.style.filter = `${actors.length > 1 && k !== speaker ? "brightness(.55) " : ""}drop-shadow(calc(var(--u) * 1.2) calc(var(--u) * 1.2) 0 ${k === speaker ? COLOR.blood : COLOR.ink})`
      if (actor.el) actor.el.style.zIndex = k === speaker ? "3" : "2"
    }
    if (speaker >= 0)
      play(
        actors[speaker]?.image ?? null,
        [
          { transform: "translateY(2%)" },
          { transform: "translateY(-1.5%)" },
          { transform: "none" },
        ],
        {
          duration: 300,
          easing: "cubic-bezier(.34,1.56,.64,1)",
        }
      )
  }, [index, asking, queue])

  // 窓は AnimatePresence が下へ滑らせ、滑り終わってから次へ進む
  const end = async (result: number) => {
    if (ending.current) return
    ending.current = true
    if (after) await after(result)
    lifetime.current.assertActive()
    setClosing(result)
  }
  const closed = () => {
    if (closing === null) return
    onDone(closing)
  }

  const next = () => {
    if (opening || ending.current || asking || closing !== null) return
    if (!typing.done) return typing.finish()
    if (index + 1 < queue.length) return setIndex(index + 1)
    if (script.choice && picked < 0) return setAsking(true)
    void end(picked).catch(reportAnimationError)
  }

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key === "Tab") {
        const buttons = [
          ...(dialog.current?.querySelectorAll<HTMLButtonElement>(
            "button:not(:disabled)"
          ) ?? []),
        ]
        event.preventDefault()
        const current = buttons.indexOf(
          document.activeElement as HTMLButtonElement
        )
        const index =
          current < 0
            ? event.shiftKey
              ? buttons.length - 1
              : 0
            : (current + (event.shiftKey ? -1 : 1) + buttons.length) %
              buttons.length
        buttons[index]?.focus({ preventScroll: true })
        return
      }
      if (asking) return
      if (["Enter", " ", "ArrowRight"].includes(event.key)) {
        event.preventDefault()
        if (!event.repeat) next()
      }
    }
    addEventListener("keydown", key, true)
    return () => removeEventListener("keydown", key, true)
  })

  const decide = (i: number) => {
    setPicked(i)
    setAsking(false)
    setQueue(script.choice!.options[i][1])
    setIndex(0)
  }

  const root = stage.canvas.current?.parentElement
  if (!root) return null
  const name = line?.[2] ?? actors[line?.[0] ?? -1]?.name ?? ""
  return createPortal(
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      data-conversation-dialog=""
      aria-label={label}
      style={{ ...REVERT, display: "contents" }}
    >
      <div style={{ ...REVERT, position: "absolute", inset: 0, zIndex: 59 }} />
      <AnimatePresence onExitComplete={() => closed()}>
        {closing === null ? (
          <motion.button
            ref={talkButton}
            key="talkbox"
            type="button"
            className="talkbox"
            aria-label="会話を進める"
            data-conversation-ready={
              !opening && !asking && typing.done && closing === null
                ? ""
                : undefined
            }
            aria-live="polite"
            onClick={next}
            disabled={asking}
            onAnimationComplete={() => {
              if (closing !== null || opened.current) return
              opened.current = true
              if (onOpened)
                void onOpened()
                  .then(() => {
                    setOpening(false)
                  })
                  .catch(reportAnimationError)
            }}
            initial={{ y: "110%" }}
            animate={{
              y: "0%",
              transition: {
                duration: seconds(420),
                delay: seconds(200),
                ease: MOTION_EASE.out,
              },
            }}
            exit={{
              y: "110%",
              transition: { duration: seconds(300), ease: MOTION_EASE.in },
            }}
            style={{
              ...BUTTON_BASE,
              position: "absolute",
              left: "-2%",
              right: "-2%",
              bottom: 0,
              zIndex: 60,
              height: conversationBoxHeight(wideFormation),
              padding: wideFormation ? "2.8vh 12% 0" : "3vh 8% 0",
              color: PALETTE.paper,
              textAlign: "left",
              fontSize: unit(wideFormation ? 3.2 : 4.6),
              fontWeight: 900,
              lineHeight: 1.55,
              isolation: "isolate",
              cursor: asking ? "default" : "pointer",
            }}
          >
            {/* 紙の縁と、その上の黒い窓 */}
            <TornPlate
              background={PALETTE.paper}
              clip="polygon(0 12.5%, 38% 0.5%, 100% 8.5%, 100% 100%, 0 100%)"
              style={{ zIndex: -2, translate: "0 -0.6vh" }}
            />
            <TornPlate
              background={PALETTE.ink}
              clip="polygon(0 14%, 38% 2%, 100% 10%, 100% 100%, 0 100%)"
              style={{ zIndex: -1 }}
            />
            {name ? (
              <TornLabel
                background={PALETTE.blood}
                color={PALETTE.paper}
                clip="polygon(3% 0, 100% 10%, 97% 100%, 0 88%)"
                style={{
                  position: "absolute",
                  left: "6%",
                  top: "-1.2vh",
                  padding: "0.05em 0.7em",
                  fontSize: "0.8em",
                  rotate: "-4deg",
                }}
              >
                {name}
              </TornLabel>
            ) : null}
            {/* セリフは2行まで。はみ出す分は「…」で切る（台本は2行に収まる長さで書く） */}
            <span
              style={{
                ...REVERT,
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 2,
                overflow: "hidden",
                maxWidth: "60em",
              }}
            >
              {typing.shown}
            </span>
            <NextMark visible={!opening && !asking && typing.done} />
          </motion.button>
        ) : null}
      </AnimatePresence>
      {/* 返事はセリフの窓の上に並べ、押した返事でそのまま答える（確定のボタンは置かない）。窓には最後のセリフを残す */}
      {asking && script.choice ? (
        <div
          role="group"
          aria-label={script.choice.ask}
          style={{
            ...REVERT,
            position: "absolute",
            left: "4%",
            right: wideFormation ? "3%" : "4%",
            bottom: `calc(${conversationBoxHeight(wideFormation)} + 2vh)`,
            zIndex: 61,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: unit(wideFormation ? 4 : 5),
            pointerEvents: "auto",
          }}
        >
          {/* 返事は街のメニューと同じ札。右端に寄せ、1枚ずつ傾きを変えて右から飛び込ませる */}
          {script.choice.options.map(([label], index) => (
            <Word
              key={label}
              text={label}
              size={wideFormation ? 5 : 6.4}
              paper={index === 0}
              tilt={index % 2 ? 3 : -4}
              rotate={index % 2 ? 2 : -3}
              delay={index * 90}
              buttonRef={index === 0 ? firstOption : undefined}
              onClick={() => decide(index)}
              style={{
                position: "relative",
                marginRight: index % 2 ? unit(4) : 0,
              }}
            />
          ))}
        </div>
      ) : null}
    </div>,
    root
  )
}

/** 次へ進める合図。点滅する。 */
function NextMark({ visible }: { visible: boolean }) {
  return (
    <motion.span
      aria-hidden="true"
      animate={visible ? { opacity: [1, 0] } : { opacity: 1 }}
      transition={
        visible
          ? { duration: 0.7, ease: steps(2), repeat: Infinity }
          : { duration: 0 }
      }
      style={{
        ...REVERT,
        position: "absolute",
        right: "8%",
        bottom: "3vh",
        fontSize: "1.1em",
        color: PALETTE.blood,
        visibility: visible ? "visible" : "hidden",
      }}
    >
      ▼
    </motion.span>
  )
}

import { after } from "@/components/canvas/animation"
import { useAnimationEffect } from "@/components/canvas/use-animation"
import { useRef, useState, type CSSProperties } from "react"
import { frameOf } from "@/lib/content/looks"
import { COLOR, EASE_OUT, countUp } from "@/components/stage/kit"
import { Ransom } from "@/components/stage/ransom"
import { SlantPanel, type PanelHandle } from "@/components/stage/panel"
import { LeavingContext } from "@/components/stage/stage-context"
import { useFx } from "@/components/stage/use-fx"
import { Word, useWide } from "@/components/stage/word"
import { useGame } from "@/contexts/game"
import type { LevelUp } from "@/lib/wiz"
import { IMG_BASE } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"

/** 一人分のレベルアップ。立ち絵が下から上がり、Lvとステータスが数え上がる。 */
export function LevelUpPanel({
  entry,
  onOk,
}: {
  entry: LevelUp
  onOk: () => void
}) {
  const game = useGame()
  const fx = useFx()
  const wide = useWide()
  const panel = useRef<PanelHandle>(null)
  const figure = useRef<HTMLImageElement>(null)
  const info = useRef<HTMLDivElement>(null)
  const toLevel = useRef<HTMLSpanElement>(null)
  const statRows = useRef<(HTMLDivElement | null)[]>([])
  const statValues = useRef<(HTMLElement | null)[]>([])
  const [closing, setClosing] = useState(false)
  const member = game.queries.member(game.state, entry.member)
  const frame = frameOf(
    game.queries.look(game.state, entry.member),
    member?.armor?.good
  )
  const rows = [
    ["HP", entry.before.maxHp, entry.after.maxHp],
    ["筋力", entry.before.str, entry.after.str],
    ["技量", entry.before.tec, entry.after.tec],
    ["速さ", entry.before.spd, entry.after.spd],
  ] as const
  useAnimationEffect(() => {
    play(
      figure.current,
      [
        { transform: "translateY(100%)", easing: EASE_OUT },
        {
          transform: "translateY(-2%)",
          offset: 0.6,
          easing: "cubic-bezier(.34,1.56,.64,1)",
        },
        { transform: "none" },
      ],
      {
        duration: 700,
        delay: 150,
        fill: "both",
      }
    )
    play(
      info.current,
      [{ transform: "translateX(60vw) rotate(10deg)" }, { transform: "none" }],
      { duration: 520, delay: 250, easing: EASE_OUT, fill: "both" }
    )
    const levelArrival = play(
      toLevel.current,
      [
        {
          transform: "scale(4) rotate(-30deg)",
          opacity: 0,
          easing: "cubic-bezier(.2,1.6,.4,1)",
        },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: 380, delay: 650, fill: "both" }
    )
    after(levelArrival, () => {
      const c = fx.center(toLevel.current)
      fx.burst(c.x, c.y - c.h * 0.8, c.h * 2.2, "レベルアップ！", {
        fill: COLOR.blood,
        ink: COLOR.paper,
        hold: 1000,
      })
      fx.shards(c.x, c.y, { n: 24, power: 1.6 })
      fx.hitStop(1.4)
      fx.shake(1.2)
    })
    for (const [i, row] of statRows.current.entries()) {
      const rowArrival = play(
        row,
        [
          { transform: "translateX(40vw)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        {
          duration: 380,
          delay: 1100 + i * 90,
          easing: "cubic-bezier(.34,1.56,.64,1)",
          fill: "both",
        }
      )
      after(rowArrival, () => {
        const v = statValues.current[i]
        const [, a, b] = rows[i]
        countUp(v, a, b, 360)
        if (b > a)
          play(
            v,
            [
              { scale: 1.6, color: COLOR.sage },
              { scale: 1, color: COLOR.paper },
            ],
            { duration: 420, easing: "cubic-bezier(.34,1.56,.64,1)" }
          )
      })
    }

    // 一人につき一度
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <LeavingContext.Provider value={closing}>
      <SlantPanel
        ref={panel}
        z={33}
        inset={{ top: "4%", bottom: "2%" }}
        rotate={-3}
      >
        <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          <img
            ref={figure}
            src={frame.img}
            alt=""
            style={{
              ...IMG_BASE,
              position: "absolute",
              left: `${wide ? 26 : 40}%`,
              top: `${wide ? 6 : 34}%`,
              height: `${wide ? 94 : 66}%`,
              translate: `calc(${frame.fx} * -100%) 0`,
              filter: `drop-shadow(calc(var(--u)*1.4) calc(var(--u)*1.4) 0 ${COLOR.blood})`,
            }}
          />
          <div
            ref={info}
            style={{
              position: "absolute",
              ...(wide
                ? { right: "6%", top: "14%", width: "40%" }
                : { left: "5%", right: "5%", top: "8%" }),
              rotate: "-3deg",
            }}
          >
            <Ransom text={member?.name ?? ""} size={wide ? 6 : 7} delay={400} />
            <div
              style={{
                marginTop: "calc(var(--u)*1.4)",
                display: "flex",
                alignItems: "baseline",
                gap: "calc(var(--u)*1.6)",
                color: COLOR.paper,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: "calc(var(--u)*3)" }}>Lv</span>
              <span style={{ fontSize: "calc(var(--u)*8)", opacity: 0.55 }}>
                {entry.from}
              </span>
              <span
                style={{ fontSize: "calc(var(--u)*5)", color: COLOR.blood }}
              >
                ▶
              </span>
              <span
                ref={toLevel}
                style={
                  {
                    display: "inline-block",
                    fontSize: `calc(var(--u)*${wide ? 17 : 15})`,
                    lineHeight: 0.9,
                    WebkitTextStroke: `.05em ${COLOR.ink}`,
                    paintOrder: "stroke fill",
                    textShadow: `.05em .05em 0 ${COLOR.ink},.09em .09em 0 ${COLOR.blood}`,
                  } as CSSProperties
                }
              >
                {entry.to}
              </span>
            </div>
            <div
              style={{
                marginTop: "calc(var(--u)*1.6)",
                display: "grid",
                gap: "calc(var(--u)*.7)",
              }}
            >
              {rows.map(([label, a, b], index) => (
                <div
                  key={label}
                  ref={(element) => {
                    statRows.current[index] = element
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "5em 1fr auto",
                    alignItems: "baseline",
                    gap: ".6em",
                    padding: ".1em .6em",
                    background: "rgb(238 235 227 / .08)",
                    clipPath: "polygon(0 0, 100% 10%, 99% 100%, 1% 90%)",
                    color: COLOR.paper,
                    fontSize: `calc(var(--u)*${wide ? 2.8 : 3.2})`,
                  }}
                >
                  <span style={{ opacity: 0.7 }}>{label}</span>
                  <span>
                    <span style={{ opacity: 0.55 }}>{a}</span>{" "}
                    <span style={{ color: COLOR.blood }}>▶</span>{" "}
                    <b
                      ref={(element) => {
                        statValues.current[index] = element
                      }}
                      style={{ display: "inline-block", fontSize: "1.4em" }}
                    >
                      {a}
                    </b>
                  </span>
                  <b
                    style={{
                      color: b > a ? COLOR.sage : "rgb(238 235 227 / .4)",
                    }}
                  >
                    {b > a ? `+${b - a}` : "±0"}
                  </b>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <Word
            text="OK"
            size={wide ? 14 : 13}
            paper
            big
            tilt={-4}
            rotate={-7}
            delay={900}
            style={{
              pointerEvents: "auto",
              zIndex: 38,
              ...(wide
                ? { right: "4vw", bottom: "8%" }
                : { right: "2vw", bottom: "6%" }),
            }}
            onClick={async () => {
              setClosing(true)
              await panel.current?.close()
              onOk()
            }}
          />
        </div>
      </SlantPanel>
    </LeavingContext.Provider>
  )
}

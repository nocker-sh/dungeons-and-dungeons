import { projectRoute } from "@/client/components/game/route-projection"
import type { RouteView } from "@/client/components/game/route-projection"
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react"
import { motion } from "motion/react"
import { EVENT_ICONS, EVENT_NAMES } from "@/client/components/game/art-shared"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { EASE_OUT, EASE_POP } from "@/client/components/stage/kit"
import type { EventKind } from "@/lib/wiz/content/constants"
import { play } from "@/client/components/canvas/play"
import { TornLabel } from "@/client/components/canvas/torn-label"
import type { Geometry } from "@/client/components/game/route-geometry"
import { Node } from "@/client/components/game/node"

export type RouteMapHandle = {
  /** 地点の中心（view基準ではなく画面座標）。 */
  node: (id: string) => HTMLElement | null
  /** 一地点進んだときの動き：道のりが一地点分すべり、着いた地点がめくれて出来事の札が出る。 */
  arrive: (id: string, kind: EventKind) => void
}

/**
 * 画面を横断する道のり図。地点は大きな傾いたアイコン。通過した地点は出来事のアイコン、先は「？」、終点のボスだけ最初から見える。
 * 分岐では選べる地点を押して行き先を選ぶ。
 */
type Props = {
  route: RouteView
  geo: Geometry
  pick: string | null
  onPick: (id: string) => void
  draw?: boolean
}

export const RouteMap = forwardRef<
  RouteMapHandle,
  {
    route: RouteView
    geo: Geometry
    pick: string | null
    onPick: (id: string) => void
    draw?: boolean
  }
>(function RouteMap(props: Props, handle) {
  const draw = props.draw === undefined ? false : props.draw

  const map = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const tiles = useRef(new Map<string, HTMLDivElement>())
  const { here, P, branching, future, onPath, seg, stations, edges, sizeOf } =
    projectRoute(props.route, props.geo, props.pick)

  useImperativeHandle(handle, () => ({
    node: (id) => nodes.current.get(id) ?? null,
    arrive: (id, kind) => {
      play(
        map.current,
        [{ translate: `${props.geo.sp}px 0` }, { translate: "0 0" }],
        { duration: 520, easing: "cubic-bezier(.34,1.3,.64,1)" }
      )
      play(
        tiles.current.get(id) ?? null,
        [{ transform: "rotateY(90deg) scale(1.6)" }, { transform: "none" }],
        { duration: 420, delay: 250, easing: EASE_POP, fill: "backwards" }
      )
      const tag = document.createElement("div")
      tag.className = "tag"
      tag.textContent = EVENT_NAMES[kind]
      const p = P(id)
      Object.assign(tag.style, {
        position: "absolute",
        left: `${p.x}px`,
        top: `${p.y + sizeOf(id) * 0.56}px`,
        translate: "-50% 0",
        fontSize: unit(5),
        color: PALETTE.ink,
        background: PALETTE.paper,
        padding: "0.05em 0.6em",
        whiteSpace: "nowrap",
        clipPath: "polygon(4% 0, 100% 8%, 96% 100%, 0 90%)",
      })
      map.current?.append(tag)
      play(
        tag,
        [
          {
            easing: EASE_OUT,
            transform: "scale(3) rotate(-20deg)",
            opacity: 0,
          },
          { transform: "none", opacity: 1, offset: 0.25 },
          { transform: "none", opacity: 1, offset: 0.8 },
          { opacity: 0 },
        ],
        { duration: 1300, delay: 250, fill: "both" }
      ).finished.then(
        () => tag.remove(),
        () => tag.remove()
      )
    },
  }))

  // 道のり図が左から右へ一気に描かれ、地点が弾んで現れる
  useLayoutEffect(() => {
    if (!draw) return
    play(
      map.current,
      [
        { clipPath: "inset(-100vh 100% -100vh -100vw)" },
        { clipPath: "inset(-100vh -300vw -100vh -100vw)" },
      ],
      { duration: 900, easing: EASE_OUT, fill: "both" }
    )
    for (const [i, node] of [...nodes.current.values()].entries())
      play(
        node,
        [
          { scale: 0, rotate: "-40deg" },
          { scale: 1, rotate: "0deg" },
        ],
        { duration: 500, delay: 250 + i * 60, easing: EASE_POP, fill: "both" }
      )
    // 描くのは着いたときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stroke = props.geo.vh * 0.018
  const dash = `${props.geo.vh * 0.03} ${props.geo.vh * 0.025}`
  const pinTop =
    P(props.route.at).y -
    (here.boss
      ? props.geo.bossS * 0.55
      : props.route.at === props.route.start
        ? props.geo.startS * 0.6
        : props.geo.nodeS * 0.56)
  return (
    <div
      className="mapwrap"
      aria-hidden="true"
      style={{
        ...REVERT,
        position: "absolute",
        left: props.geo.anchor,
        top: "50%",
        width: 0,
        height: 0,
        pointerEvents: "none",
        rotate: "-8deg",
      }}
    >
      <div
        className="map"
        ref={map}
        style={{
          ...REVERT,
          position: "absolute",
          left: 0,
          top: 0,
          width: 0,
          height: 0,
          pointerEvents: "none",
        }}
      >
        <svg
          width="1"
          height="1"
          style={{
            ...REVERT,
            position: "absolute",
            left: 0,
            top: 0,
            overflow: "visible",
          }}
        >
          <path
            d={`M${P(props.route.start).x - props.geo.sp * 6} 0 L${P(props.route.start).x} 0`}
            stroke="#eeebe3"
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
          {edges.map(([a, b]) => {
            const done = onPath.has(a) && onPath.has(b)
            const ahead =
              (a === props.route.at || future.has(a)) && future.has(b)
            const alt = branching && a === props.route.at
            return (
              <path
                key={`${a}-${b}`}
                d={seg(a, b)}
                stroke="#eeebe3"
                strokeWidth={stroke}
                strokeLinecap="butt"
                strokeLinejoin="miter"
                fill="none"
                opacity={done || ahead ? 1 : alt ? 0.55 : 0.18}
                strokeDasharray={ahead && !done ? dash : "none"}
              />
            )
          })}
        </svg>
        {stations.map((station) => {
          const choosing = branching && here.next.includes(station.id)
          const isStart = station.id === props.route.start
          return (
            <Node
              key={station.id}
              nodeRef={(el) => {
                if (el) nodes.current.set(station.id, el)
                else nodes.current.delete(station.id)
              }}
              tileRef={(el) => {
                if (el) tiles.current.set(station.id, el)
                else tiles.current.delete(station.id)
              }}
              point={P(station.id)}
              size={sizeOf(station.id)}
              startSize={props.geo.startS}
              tilt={
                isStart
                  ? -6
                  : (station.x % 2 ? 7 : -6) +
                    Math.max(-2, Math.min(2, station.y - here.y)) * 3
              }
              isStart={isStart}
              boss={station.boss || station.midboss}
              now={station.id === props.route.at}
              off={
                !isStart &&
                !station.visited &&
                !future.has(station.id) &&
                !choosing
              }
              choosing={choosing}
              chosen={choosing && station.id === props.pick}
              icon={
                station.event
                  ? EVENT_ICONS[station.event]
                  : station.boss || station.midboss
                    ? EVENT_ICONS[station.boss ? "boss" : "midboss"]
                    : null
              }
              onPick={() => props.onPick(station.id)}
            />
          )
        })}
        <motion.div
          initial={false}
          transition={{
            left: { duration: 0.7, ease: [0.34, 1.3, 0.64, 1], repeat: 0 },
            top: { duration: 0.7, ease: [0.34, 1.3, 0.64, 1], repeat: 0 },
          }}
          animate={{ left: P(props.route.at).x, top: pinTop }}
          className="pin"
          style={{
            ...REVERT,
            position: "absolute",

            translate: "-50% -100%",
          }}
        >
          <TornLabel
            background={PALETTE.blood}
            color={PALETTE.paper}
            clip="polygon(0 0, 100% 6%, 96% 100%, 4% 92%)"
            style={{
              display: "block",
              padding: "0.15em 0.6em",
              fontSize: unit(4),
              fontWeight: "bold",
              letterSpacing: "0.15em",
              whiteSpace: "nowrap",
            }}
          >
            いまココ
          </TornLabel>
          <i
            style={{
              ...REVERT,
              display: "block",
              margin: "0 auto",
              width: unit(2.4),
              height: unit(2),
              background: PALETTE.blood,
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }}
          />
        </motion.div>
      </div>
    </div>
  )
})

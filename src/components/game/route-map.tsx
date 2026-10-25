import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react"
import { motion } from "motion/react"
import { EVENT_ICONS, EVENT_NAMES, Svg } from "@/components/game/art"
import { useActiveMark, usePointerState } from "@/components/canvas/state"
import { PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { EASE_OUT, EASE_POP, MOTION_EASE } from "@/components/stage/kit"
import type { EventKind } from "@/lib/wiz"
import { play } from "@/components/canvas/play"
import { TornLabel, TornPlate } from "@/components/canvas/paper"

export type RouteView = {
  start: string
  at: string
  stations: readonly {
    id: string
    x: number
    y: number
    next: readonly string[]
    boss: boolean
    midboss: boolean
    event: EventKind | null
    visited: boolean
  }[]
  choices: readonly string[]
}

export type RouteMapHandle = {
  /** 地点の中心（view基準ではなく画面座標）。 */
  node: (id: string) => HTMLElement | null
  /** 一地点進んだときの動き：道のりが一地点分すべり、着いた地点がめくれて出来事の札が出る。 */
  arrive: (id: string, kind: EventKind) => void
}

export type Geometry = {
  sp: number
  off: number
  anchor: number
  nodeS: number
  bossS: number
  startS: number
  vh: number
}

export function geometry(wide: boolean, vw: number, vh: number): Geometry {
  const sp = wide ? Math.max(190, Math.min(vw * 0.26, vh * 0.46)) : vw * 0.33
  return {
    sp,
    off: sp * (wide ? 0.4 : 0.55),
    anchor: wide ? vw * 0.3 : vw * 0.5 - sp,
    nodeS: wide ? vh * 0.2 : sp * 0.7,
    bossS: wide ? vh * 0.27 : sp * 0.9,
    startS: wide ? vh * 0.13 : sp * 0.48,
    vh,
  }
}

/**
 * 画面を横断する道のり図。地点は大きな傾いたアイコン。通過した地点は出来事のアイコン、先は「？」、終点のボスだけ最初から見える。
 * 分岐では選べる地点を押して行き先を選ぶ。
 */
export const RouteMap = forwardRef<
  RouteMapHandle,
  {
    route: RouteView
    geo: Geometry
    pick: string | null
    onPick: (id: string) => void
    draw?: boolean
  }
>(function RouteMap({ route, geo, pick, onPick, draw = false }, handle) {
  const map = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLDivElement>())
  const tiles = useRef(new Map<string, HTMLDivElement>())
  const byId = new Map(route.stations.map((station) => [station.id, station]))
  const here = byId.get(route.at)!
  // 道のりは合流しない木なので、高さは今いる地点からの差で描く
  const P = (id: string) => {
    const station = byId.get(id)!
    return {
      x: (station.x - here.x) * geo.sp,
      y: (station.y - here.y) * geo.off,
    }
  }
  const branching = here.next.length > 1
  const future = new Set<string>()
  const walk = (id: string) => {
    for (const next of byId.get(id)?.next ?? []) {
      if (branching && id === route.at && next !== pick) continue
      future.add(next)
      walk(next)
    }
  }
  walk(route.at)
  const onPath = new Set(
    route.stations
      .filter((station) => station.visited)
      .map((station) => station.id)
  )
  const seg = (a: string, b: string) => {
    const A = P(a)
    const B = P(b)
    return `M${A.x.toFixed(1)} ${A.y} L${B.x.toFixed(1)} ${B.y}`
  }
  // 通った地点と、ここから行ける地点だけを描く（選ばなかった枝の先は消える）
  const shown = new Set([
    route.start,
    route.at,
    ...onPath,
    ...future,
    ...(branching ? here.next : []),
  ])
  const stations = route.stations.filter((station) => shown.has(station.id))
  const edges = stations.flatMap((station) =>
    station.next
      .filter((next) => shown.has(next))
      .map((next) => [station.id, next] as const)
  )
  const sizeOf = (id: string) =>
    byId.get(id)?.boss
      ? geo.bossS
      : byId.get(id)?.midboss
        ? (geo.bossS + geo.nodeS) / 2
        : id === route.start
          ? geo.startS
          : geo.nodeS

  useImperativeHandle(handle, () => ({
    node: (id) => nodes.current.get(id) ?? null,
    arrive: (id, kind) => {
      play(
        map.current,
        [{ translate: `${geo.sp}px 0` }, { translate: "0 0" }],
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

  const stroke = geo.vh * 0.018
  const dash = `${geo.vh * 0.03} ${geo.vh * 0.025}`
  const pinTop =
    P(route.at).y -
    (here.boss
      ? geo.bossS * 0.55
      : route.at === route.start
        ? geo.startS * 0.6
        : geo.nodeS * 0.56)
  return (
    <div
      className="mapwrap"
      aria-hidden="true"
      style={{
        ...REVERT,
        position: "absolute",
        left: geo.anchor,
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
            d={`M${P(route.start).x - geo.sp * 6} 0 L${P(route.start).x} 0`}
            stroke="#eeebe3"
            strokeWidth={stroke}
            strokeLinecap="butt"
          />
          {edges.map(([a, b]) => {
            const done = onPath.has(a) && onPath.has(b)
            const ahead = (a === route.at || future.has(a)) && future.has(b)
            const alt = branching && a === route.at
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
          const isStart = station.id === route.start
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
              startSize={geo.startS}
              tilt={
                isStart
                  ? -6
                  : (station.x % 2 ? 7 : -6) +
                    Math.max(-2, Math.min(2, station.y - here.y)) * 3
              }
              isStart={isStart}
              boss={station.boss || station.midboss}
              now={station.id === route.at}
              off={
                !isStart &&
                !station.visited &&
                !future.has(station.id) &&
                !choosing
              }
              choosing={choosing}
              chosen={choosing && station.id === pick}
              icon={
                station.event
                  ? EVENT_ICONS[station.event]
                  : station.boss || station.midboss
                    ? EVENT_ICONS[station.boss ? "boss" : "midboss"]
                    : null
              }
              onPick={() => onPick(station.id)}
            />
          )
        })}
        <motion.div
          initial={false}
          transition={{
            left: { duration: 0.7, ease: [0.34, 1.3, 0.64, 1], repeat: 0 },
            top: { duration: 0.7, ease: [0.34, 1.3, 0.64, 1], repeat: 0 },
          }}
          animate={{ left: P(route.at).x, top: pinTop }}
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

const TILE_CLIP = "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)"

/** 道のり図の地点ひとつ。分岐では押して行き先を選ぶ。 */
function Node({
  nodeRef,
  tileRef,
  point,
  size,
  startSize,
  tilt,
  isStart,
  boss,
  now,
  off,
  choosing,
  chosen,
  icon,
  onPick,
}: {
  nodeRef: (el: HTMLDivElement | null) => void
  /** 地点の絵札を親へ預ける（着いたときにめくれる）。 */
  tileRef: (el: HTMLDivElement | null) => void
  point: { x: number; y: number }
  size: number
  startSize: number
  tilt: number
  isStart: boolean
  boss: boolean
  now: boolean
  off: boolean
  choosing: boolean
  chosen: boolean
  icon: string | null
  onPick: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const active = useActiveMark(ref)
  const pointer = usePointerState()
  const light = now || chosen
  return (
    // 選べる地点は、選んだ方を大きく（1.12）、選ばない方を小さく（0.62）して、0.9 秒ごとに 1.1 倍へ脈打つ。大きさは motion が持つ
    <motion.div
      initial={false}
      ref={(el) => {
        ref.current = el
        nodeRef(el)
      }}
      className={["node", choosing ? "pick" : ""].join(" ")}
      onClick={choosing ? onPick : undefined}
      {...(choosing ? pointer.handlers : {})}
      animate={{
        scale: choosing ? [chosen ? 1.12 : 0.62, 1.1, chosen ? 1.12 : 0.62] : 1,
        filter: off
          ? "grayscale(1)"
          : choosing && !chosen
            ? "brightness(0.7)"
            : "none",
        opacity: off ? 0.28 : 1,
      }}
      transition={{
        ...(choosing
          ? { duration: 0.9, ease: "easeInOut", repeat: Infinity }
          : { duration: 0.4, ease: MOTION_EASE.pop }),
        filter: { duration: 0.3, ease: "easeInOut", repeat: 0 },
        opacity: { duration: 0.3, ease: "easeInOut", repeat: 0 },
      }}
      style={{
        ...REVERT,
        position: "absolute",
        left: point.x,
        top: point.y,
        translate: "-50% -50%",
        display: "grid",
        placeItems: "center",

        pointerEvents: choosing ? "auto" : undefined,
        cursor: choosing ? "pointer" : undefined,
      }}
    >
      <div
        ref={tileRef}
        style={{
          ...REVERT,
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: size,
          aspectRatio: 1.05,
          rotate: `${tilt}deg`,
          scale: choosing && pointer.hover ? 1.08 : undefined,
        }}
      >
        <TornPlate
          background={
            choosing
              ? chosen
                ? PALETTE.paper
                : PALETTE.ink
              : now
                ? PALETTE.paper
                : boss
                  ? PALETTE.blood
                  : PALETTE.ink
          }
          clip={TILE_CLIP}
        />
        <TornPlate
          clip={TILE_CLIP}
          style={{
            inset: "7%",
            boxShadow: `inset 0 0 0 ${unit(choosing && active ? 0.9 : 0.45)} ${choosing && active ? PALETTE.blood : PALETTE.paper}`,
          }}
        />
        {isStart ? (
          <span
            style={{
              ...REVERT,
              position: "relative",
              fontSize: startSize * 0.35,
              lineHeight: 1,
              color: light ? PALETTE.ink : PALETTE.paper,
            }}
          >
            開始
          </span>
        ) : icon ? (
          <Svg
            html={icon}
            style={{
              position: "relative",
              width: "62%",
              height: "62%",
              filter: now ? "invert(1)" : undefined,
            }}
          />
        ) : (
          <span
            style={{
              ...REVERT,
              position: "relative",
              fontSize: size * 0.62,
              lineHeight: 1,
              color: light ? PALETTE.ink : PALETTE.paper,
            }}
          >
            ？
          </span>
        )}
      </div>
      {choosing ? (
        <TornLabel
          background={chosen ? PALETTE.blood : PALETTE.paper}
          color={chosen ? PALETTE.paper : PALETTE.ink}
          clip="polygon(3% 0, 100% 8%, 97% 100%, 0 92%)"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "100%",
            translate: "-50% -0.3em",
            whiteSpace: "nowrap",
            fontSize: unit(3.4),
            padding: "0.1em 0.6em",
            pointerEvents: "none",
          }}
        >
          {chosen ? "▶ こっちへ進む" : "こっち？"}
        </TornLabel>
      ) : null}
    </motion.div>
  )
}

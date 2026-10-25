import { useState } from "react"
import { useGame, useGameState } from "@/contexts/game"
import { useArrival, useNav } from "@/components/game/nav"
import { GameCommandError, inPhase } from "@/lib/wiz"
import { sceneOf } from "@/lib/content/looks"
import { REVERT, PALETTE } from "@/components/canvas/tokens"
import { useVisitScene } from "@/components/game/event-conversation"

const terrain = {
  road: "#857152",
  village: "#9b6952",
  forest: "#436b45",
  wetland: "#3a6874",
  mountain: "#706779",
}

/** 初めての道は一マスずつ。村の会話から道が開き、現地で契約書と素材を拾う。 */
export function WorldMap() {
  const game = useGame()
  const state = useGameState()
  const nav = useNav()
  const ready = useArrival(sceneOf("town"), "none", 4)
  const map = game.queries.worldMap(state)
  useVisitScene(
    map?.tiles.find((tile) => tile.id === map.start)?.place ?? "",
    ready
  )
  const [notice, setNotice] = useState(
    "隣のマスを選んで移動。村や採集地では「調べる」。"
  )
  if (!ready || !map) return null
  const run = (command: () => unknown, message: string) => {
    const result = command()
    setNotice(
      result instanceof GameCommandError
        ? "今はできない。進行と道の解放を確かめよう。"
        : message
    )
  }
  const button = {
    ...REVERT,
    display: "block",
    background: PALETTE.paper,
    color: PALETTE.ink,
    border: "2px solid #1b1520",
    padding: "10px 14px",
    fontWeight: 800,
    fontSize: 14,
    cursor: "pointer",
  } as const
  const current = map.tiles.find((tile) => tile.current)!
  const width = Math.min(420, 64 * map.width)
  return (
    <div
      tabIndex={0}
      aria-label="ワールドマップ"
      onKeyDown={(event) => {
        const directions: Record<string, [number, number]> = {
          ArrowUp: [0, -1],
          ArrowDown: [0, 1],
          ArrowLeft: [-1, 0],
          ArrowRight: [1, 0],
        }
        const direction = directions[event.key]
        if (!direction) return
        event.preventDefault()
        const tile = map.tiles.find(
          (tile) =>
            tile.canMove &&
            tile.x === current.x + direction[0] &&
            tile.y === current.y + direction[1]
        )
        if (tile)
          run(
            () => inPhase(game, "town")?.moveWorld(tile.id),
            `${tile.name}へ着いた。`
          )
      }}
      style={{
        ...REVERT,
        position: "absolute",
        inset: 0,
        zIndex: 25,
        pointerEvents: "auto",
        background: "#161823",
        color: PALETTE.paper,
        overflowY: "auto",
        padding: "45px 14px 160px",
        boxSizing: "border-box",
        fontFamily: "inherit",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>ワールドマップ</h1>
        <p style={{ fontSize: 14, margin: "0 0 8px" }}>
          現在地：{map.current.name}
        </p>
        <p
          role="status"
          style={{ fontSize: 12, minHeight: 32, margin: "0 0 10px" }}
        >
          {notice}
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${map.width}, 1fr)`,
            width: "100%",
            maxWidth: width,
            gap: 4,
            margin: "0 auto 12px",
          }}
        >
          {Array.from({ length: map.width * map.height }, (_, index) => {
            const tile = map.tiles.find(
              (entry) =>
                entry.x === index % map.width &&
                entry.y === Math.floor(index / map.width)
            )
            return (
              <button
                key={index}
                type="button"
                aria-label={
                  tile?.visible
                    ? `${tile.name}${tile.current ? "・現在地" : ""}`
                    : "未踏査のマス"
                }
                disabled={!tile?.canMove}
                onClick={() =>
                  tile &&
                  run(
                    () => inPhase(game, "town")?.moveWorld(tile.id),
                    `${tile.name}へ着いた。`
                  )
                }
                style={{
                  ...button,
                  aspectRatio: "1",
                  minWidth: 0,
                  padding: 3,
                  fontSize: 11,
                  background: tile?.visible ? terrain[tile.biome] : "#252735",
                  color: PALETTE.paper,
                  border: tile?.current
                    ? "3px solid #ffd666"
                    : "1px solid #777",
                  opacity: tile?.visible ? 1 : 0.6,
                  cursor: tile?.canMove ? "pointer" : "default",
                }}
              >
                {tile?.visible ? (
                  <>
                    {tile.current ? "● " : ""}
                    {tile.name}
                  </>
                ) : (
                  "？"
                )}
              </button>
            )
          })}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            style={button}
            disabled={!map.ready || (current.collected && !current.place)}
            onClick={() =>
              run(
                () => inPhase(game, "town")?.visitWorld(),
                current.collected
                  ? "村の話を聞こう。"
                  : "この場所を調べた。持ち物に契約書や素材をしまった。"
              )
            }
          >
            調べる
          </button>
          {map.current.dungeon ? (
            <button
              type="button"
              style={button}
              disabled={
                !map.ready ||
                !game.queries.readiness(state).ready ||
                state.reached <
                  game.queries
                    .destinations(state)
                    .findIndex((layer) => layer.id === map.current.dungeon)
              }
              onClick={() => {
                const result = inPhase(game, "town")?.depart(
                  map.current.dungeon!
                )
                if (result instanceof GameCommandError)
                  setNotice("宿で回復し、三人の準備を整えよう。")
                else void nav.go({ name: "expedition" }, { enter: "none" })
              }}
            >
              ダンジョンへ
            </button>
          ) : null}
          <button
            type="button"
            style={button}
            disabled={!map.ready}
            onClick={() => {
              if (map.current.id !== map.start) {
                const result = inPhase(game, "town")?.travelWorld(map.start)
                if (result instanceof GameCommandError) return
              }
              void nav.go({ name: "town" }, { enter: "none" })
            }}
          >
            街へ戻る
          </button>
        </div>
        {map.current.dungeon ? (
          <p style={{ fontSize: 13, textAlign: "center" }}>
            入口：
            {
              game.queries
                .destinations(state)
                .find((layer) => layer.id === map.current.dungeon)?.name
            }
          </p>
        ) : null}
        <p style={{ fontSize: 12 }}>訪れた拠点へ：</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {map.tiles
            .filter((tile) => tile.canTravel)
            .map((tile) => (
              <button
                type="button"
                key={tile.id}
                style={button}
                onClick={() =>
                  run(
                    () => inPhase(game, "town")?.travelWorld(tile.id),
                    `${tile.name}へ移動した。`
                  )
                }
              >
                {tile.name}
              </button>
            ))}
        </div>
        {map.requests.length ? (
          <div
            style={{ marginTop: 16, padding: 12, border: "1px solid #796e58" }}
          >
            <strong>悪魔との約束</strong>
            {map.requests.map((request) => (
              <p key={request.demon} style={{ fontSize: 13 }}>
                {request.demon}：
                {request.materials
                  .map(
                    (material) =>
                      `${material.name} ${material.count}個（${material.locations.map((location) => location.name).join("・") || "ダンジョンで探す"}）`
                  )
                  .join("、")}
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

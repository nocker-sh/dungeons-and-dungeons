import { CanvasBox, CanvasButton } from "@/components/canvas/primitives"
import { useLayoutEffect, useRef } from "react"
import type { ComponentProps } from "react"
import { useActiveMark } from "@/components/canvas/state"
import { useGame } from "@/contexts/game"
import { GameCommandError, inPhase } from "@/lib/wiz"
import { PALETTE } from "@/components/canvas/tokens"
import type { RefObject } from "react"
import type { RouteView } from "./types"

function RouteChoiceButton(props: ComponentProps<typeof CanvasButton>) {
  const button = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(button)
  return (
    <CanvasButton
      {...props}
      ref={button}
      style={{
        ...props.style,
        outline: active ? `3px solid ${PALETTE.blood}` : undefined,
        outlineOffset: 2,
      }}
    />
  )
}

/** 分岐の選択と、選んだ道の見通し。進行は親の画面が管理する。 */
export function BranchChoices({
  route,
  pick,
  setPick,
  wide,
  selectedPath,
  selectedPathDetails,
  branchDetailsHeight,
  top,
}: {
  route: RouteView
  pick: string | null
  setPick: (id: string) => void
  wide: boolean
  selectedPath: RouteView["paths"][number]
  selectedPathDetails: RefObject<HTMLDivElement | null>
  branchDetailsHeight: number | null
  top: number | null
}) {
  const game = useGame()
  useLayoutEffect(() => {
    selectedPathDetails.current?.scrollTo({ top: 0, behavior: "instant" })
  }, [selectedPath.id, route.surveyLeft, selectedPathDetails])
  return (
    <CanvasBox
      aria-label="分岐の選択"
      style={{
        position: "absolute",
        top: wide ? "8%" : top === null ? "19%" : `max(19%, ${top}px)`,
        right: "4%",
        left: wide ? "38%" : "4%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 25,
      }}
    >
      <CanvasBox style={{ display: "flex", gap: 8 }}>
        {route.paths.map((path) => (
          <RouteChoiceButton
            key={path.id}
            data-route-choice={path.id}
            aria-pressed={pick === path.id}
            onClick={() => setPick(path.id)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: wide ? 10 : 6,
              border: "3px solid",
              borderColor: pick === path.id ? PALETTE.blood : PALETTE.ink,
              background: pick === path.id ? PALETTE.paper : "#b4ae9f",
              color: PALETTE.ink,
            }}
          >
            <CanvasBox style={{ fontSize: wide ? 18 : 14, fontWeight: 900 }}>
              {path.label}
            </CanvasBox>
            <CanvasBox
              style={{
                fontSize: 12,
                fontWeight: 900,
                marginTop: 4,
                color: path.danger === "高" ? PALETTE.blood : PALETTE.ink,
              }}
            >
              危険度 {path.danger}（目安）
            </CanvasBox>
            <CanvasBox style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>
              {path.hint}
            </CanvasBox>
          </RouteChoiceButton>
        ))}
      </CanvasBox>
      <CanvasBox
        ref={selectedPathDetails}
        data-gamepad-scroll=""
        role="region"
        tabIndex={0}
        aria-label="選んだ道の見通し"
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          const distance = {
            ArrowUp: -40,
            ArrowDown: 40,
            PageUp: -event.currentTarget.clientHeight,
            PageDown: event.currentTarget.clientHeight,
            " ": event.currentTarget.clientHeight,
          }[event.key]
          if (distance !== undefined) {
            event.preventDefault()
            event.currentTarget.scrollBy({ top: distance })
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault()
            event.currentTarget.scrollTop =
              event.key === "Home" ? 0 : event.currentTarget.scrollHeight
          } else if (event.key === "Enter") event.preventDefault()
        }}
        style={{
          background: PALETTE.paper,
          color: PALETTE.ink,
          border: "2px solid",
          padding: 10,
          fontSize: 12,
          lineHeight: 1.5,
          maxHeight: wide ? 180 : (branchDetailsHeight ?? 150),
          boxSizing: "border-box",
          overflowY: "auto",
          pointerEvents: "auto",
        }}
      >
        <CanvasBox
          data-selected-path-name
          style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}
        >
          {selectedPath.label}の見通し
        </CanvasBox>
        <CanvasBox style={{ fontWeight: 900, marginBottom: 4 }}>
          進むと選ばなかった道へ戻れない
        </CanvasBox>
        {selectedPath.details.map((detail, index) => (
          <CanvasBox key={index}>{detail}</CanvasBox>
        ))}
        {route.paths.some((path) => path.canSurvey) ? (
          <RouteChoiceButton
            data-route-survey=""
            onClick={() => {
              const path =
                route.paths.find((entry) => entry.id === pick) ?? route.paths[0]
              if (path.canSurvey) {
                const result = inPhase(game, "expedition")?.survey(path.id)
                if (result && !(result instanceof GameCommandError))
                  selectedPathDetails.current?.focus({ preventScroll: true })
              }
            }}
            disabled={
              !(
                route.paths.find((entry) => entry.id === pick) ?? route.paths[0]
              ).canSurvey
            }
            style={{
              marginTop: 8,
              border: "2px solid",
              padding: 8,
              background: "#ddd7c9",
              width: "100%",
            }}
          >
            察知で正体を見抜く（残り{route.surveyLeft}回）
          </RouteChoiceButton>
        ) : null}
      </CanvasBox>
    </CanvasBox>
  )
}

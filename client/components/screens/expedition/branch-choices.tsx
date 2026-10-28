import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { scrollText } from "@/client/components/canvas/scroll-text"
import { useLayoutEffect } from "react"
import { useGame } from "@/client/contexts/use-game"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { PALETTE } from "@/client/components/canvas/tokens"
import type { RefObject } from "react"
import type { RouteView } from "@/client/components/screens/expedition/types"
import { RouteChoiceButton } from "@/client/components/screens/expedition/route-choice-button"

/** 分岐の選択と、選んだ道の見通し。進行は親の画面が管理する。 */
type Props = {
  route: RouteView
  pick: string | null
  setPick: (id: string) => void
  wide: boolean
  selectedPath: RouteView["paths"][number]
  selectedPathDetails: RefObject<HTMLDivElement | null>
  branchDetailsHeight: number | null
  top: number | null
}

export function BranchChoices(props: Props) {
  const game = useGame()
  useLayoutEffect(() => {
    props.selectedPathDetails.current?.scrollTo({ top: 0, behavior: "instant" })
  }, [props.selectedPath.id, props.route.surveyLeft, props.selectedPathDetails])
  return (
    <CanvasBox
      aria-label="分岐の選択"
      style={{
        position: "absolute",
        top: props.wide
          ? "8%"
          : props.top === null
            ? "19%"
            : `max(19%, ${props.top}px)`,
        right: "4%",
        left: props.wide ? "38%" : "4%",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 25,
      }}
    >
      <CanvasBox style={{ display: "flex", gap: 8 }}>
        {props.route.paths.map((path) => (
          <RouteChoiceButton
            key={path.id}
            data-route-choice={path.id}
            aria-pressed={props.pick === path.id}
            onClick={() => props.setPick(path.id)}
            style={{
              flex: 1,
              minWidth: 0,
              padding: props.wide ? 10 : 6,
              border: "3px solid",
              borderColor: props.pick === path.id ? PALETTE.blood : PALETTE.ink,
              background: props.pick === path.id ? PALETTE.paper : "#b4ae9f",
              color: PALETTE.ink,
            }}
          >
            <CanvasBox
              style={{ fontSize: props.wide ? 18 : 14, fontWeight: 900 }}
            >
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
        ref={props.selectedPathDetails}
        data-gamepad-scroll=""
        role="region"
        tabIndex={0}
        aria-label="選んだ道の見通し"
        onKeyDown={scrollText}
        style={{
          background: PALETTE.paper,
          color: PALETTE.ink,
          border: "2px solid",
          padding: 10,
          fontSize: 12,
          lineHeight: 1.5,
          maxHeight: props.wide ? 180 : (props.branchDetailsHeight ?? 150),
          boxSizing: "border-box",
          overflowY: "auto",
          pointerEvents: "auto",
        }}
      >
        <CanvasBox
          data-selected-path-name
          style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}
        >
          {props.selectedPath.label}の見通し
        </CanvasBox>
        <CanvasBox style={{ fontWeight: 900, marginBottom: 4 }}>
          進むと選ばなかった道へ戻れない
        </CanvasBox>
        {props.selectedPath.details.map((detail, index) => (
          <CanvasBox key={index}>{detail}</CanvasBox>
        ))}
        {props.route.paths.some((path) => path.canSurvey) ? (
          <RouteChoiceButton
            data-route-survey=""
            onClick={() => {
              const path =
                props.route.paths.find((entry) => entry.id === props.pick) ??
                props.route.paths[0]
              if (path.canSurvey) {
                const result = inPhase(game, "expedition")?.survey(path.id)
                if (result && !(result instanceof GameCommandError))
                  props.selectedPathDetails.current?.focus({
                    preventScroll: true,
                  })
              }
            }}
            disabled={
              !(
                props.route.paths.find((entry) => entry.id === props.pick) ??
                props.route.paths[0]
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
            察知で正体を見抜く（残り{props.route.surveyLeft}回）
          </RouteChoiceButton>
        ) : null}
      </CanvasBox>
    </CanvasBox>
  )
}

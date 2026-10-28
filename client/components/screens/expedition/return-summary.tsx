import { CanvasBox } from "@/client/components/canvas/canvas-box"
import { scrollText } from "@/client/components/canvas/scroll-text"
import { PALETTE } from "@/client/components/canvas/tokens"
import type { RefObject } from "react"
import type { RouteView } from "@/client/components/screens/expedition/types"

/** 帰還で持ち帰る物・成長・次の挑戦を、Queryの値から表示する。 */
type Props = {
  route: RouteView
  home: boolean
  wide: boolean
  carryingSummary: RefObject<HTMLDivElement | null>
  carryingText: string
  returnMoneyText: string
  carried: readonly string[]
  growingMembers: readonly { id: string; name: string }[]
  nextChallenge: string
}

export function ReturnSummary(props: Props) {
  return (
    <CanvasBox
      ref={props.carryingSummary}
      data-expedition-return-summary={props.home ? "" : undefined}
      role={props.home ? "region" : "status"}
      tabIndex={props.home ? 0 : undefined}
      data-gamepad-scroll={props.home ? "" : undefined}
      onKeyDown={props.home ? scrollText : undefined}
      aria-label={
        props.home
          ? "突破と帰還のまとめ"
          : `${props.carryingText}。${props.returnMoneyText}。全滅すると戦利品を失う。拾った武器は武器屋で鑑定してから装備できる${props.route.wipeKeepJunkPercent > 0 ? `。ガラクタは${props.route.wipeKeepJunkPercent}%残る（端数切り上げ）` : ""}`
      }
      style={{
        position: "absolute",
        left: "3%",
        width: "90%",
        maxWidth: 600,
        bottom:
          props.home && props.wide
            ? "36%"
            : !props.wide && props.route.choices.length > 1
              ? "20%"
              : "24%",
        padding: "6px 10px",
        boxSizing: "border-box",
        color: PALETTE.ink,
        background: PALETTE.paper,
        fontSize: 13,
        fontWeight: 900,
        lineHeight: 1.5,
        overflowWrap: "anywhere",
        pointerEvents: props.home ? "auto" : "none",
        maxHeight: props.home ? "36%" : undefined,
        overflowY: props.home ? "auto" : undefined,
      }}
    >
      {props.home ? (
        <CanvasBox style={{ fontSize: 18, marginBottom: 6 }}>
          {props.route.layer.no}層を突破！
        </CanvasBox>
      ) : null}
      <CanvasBox style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
        <span>{props.home ? "持ち帰る物：" : "抱えた物："}</span>
        {props.home && !props.carried.length ? <span>なし</span> : null}
        {props.carried.map((entry) => (
          <span
            key={entry}
            data-carried-entry=""
            style={{ whiteSpace: "nowrap" }}
          >
            {entry}
          </span>
        ))}
      </CanvasBox>
      <CanvasBox style={{ marginTop: 4, color: PALETTE.blood }}>
        {props.returnMoneyText}
      </CanvasBox>
      {props.home ? (
        <>
          {props.growingMembers.length ? (
            <CanvasBox data-expedition-growth style={{ marginTop: 6 }}>
              宿でレベルアップできる仲間：
              {props.growingMembers.map((member, index) => (
                <span
                  key={member.id}
                  style={{
                    display: "inline-block",
                    maxWidth: "100%",
                    overflowWrap: "anywhere",
                  }}
                >
                  {index > 0 ? "・" : ""}
                  {member.name}
                </span>
              ))}
            </CanvasBox>
          ) : null}
          <CanvasBox style={{ marginTop: 6 }}>
            拾った武器は武器屋で鑑定してから装備できる
          </CanvasBox>
          <CanvasBox data-expedition-next-challenge style={{ marginTop: 6 }}>
            {props.nextChallenge}
          </CanvasBox>
        </>
      ) : (
        <CanvasBox
          style={{
            fontSize: 11,
            fontWeight: 700,
            marginTop: 4,
            color: PALETTE.blood,
          }}
        >
          <span>全滅すると戦利品を失う</span>
          <CanvasBox>拾った武器は武器屋で鑑定してから装備できる</CanvasBox>
          {props.route.wipeKeepJunkPercent > 0 ? (
            <CanvasBox>
              ガラクタは{props.route.wipeKeepJunkPercent}
              %残る（端数切り上げ）
            </CanvasBox>
          ) : null}
        </CanvasBox>
      )}
    </CanvasBox>
  )
}

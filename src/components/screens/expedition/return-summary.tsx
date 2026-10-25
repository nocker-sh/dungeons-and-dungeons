import { CanvasBox } from "@/components/canvas/primitives"
import { PALETTE } from "@/components/canvas/tokens"
import type { RefObject } from "react"
import type { RouteView } from "./types"

/** 帰還で持ち帰る物・成長・次の挑戦を、Queryの値から表示する。 */
export function ReturnSummary({
  route,
  home,
  wide,
  carryingSummary,
  carryingText,
  returnMoneyText,
  carried,
  growingMembers,
  nextChallenge,
}: {
  route: RouteView
  home: boolean
  wide: boolean
  carryingSummary: RefObject<HTMLDivElement | null>
  carryingText: string
  returnMoneyText: string
  carried: readonly string[]
  growingMembers: readonly { id: string; name: string }[]
  nextChallenge: string
}) {
  return (
    <CanvasBox
      ref={carryingSummary}
      data-expedition-return-summary={home ? "" : undefined}
      role={home ? "region" : "status"}
      tabIndex={home ? 0 : undefined}
      aria-label={
        home
          ? "突破と帰還のまとめ"
          : `${carryingText}。${returnMoneyText}。全滅すると戦利品を失う。拾った武器は武器屋で鑑定してから装備できる${route.wipeKeepJunkPercent > 0 ? `。ガラクタは${route.wipeKeepJunkPercent}%残る（端数切り上げ）` : ""}`
      }
      style={{
        position: "absolute",
        left: "3%",
        width: "90%",
        maxWidth: 600,
        bottom:
          home && wide
            ? "36%"
            : !wide && route.choices.length > 1
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
        pointerEvents: home ? "auto" : "none",
        maxHeight: home ? "36%" : undefined,
        overflowY: home ? "auto" : undefined,
      }}
    >
      {home ? (
        <CanvasBox style={{ fontSize: 18, marginBottom: 6 }}>
          {route.layer.no}層を突破！
        </CanvasBox>
      ) : null}
      <CanvasBox style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
        <span>{home ? "持ち帰る物：" : "抱えた物："}</span>
        {home && !carried.length ? <span>なし</span> : null}
        {carried.map((entry) => (
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
        {returnMoneyText}
      </CanvasBox>
      {home ? (
        <>
          {growingMembers.length ? (
            <CanvasBox data-expedition-growth style={{ marginTop: 6 }}>
              宿でレベルアップできる仲間：
              {growingMembers.map((member, index) => (
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
            {nextChallenge}
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
          {route.wipeKeepJunkPercent > 0 ? (
            <CanvasBox>
              ガラクタは{route.wipeKeepJunkPercent}
              %残る（端数切り上げ）
            </CanvasBox>
          ) : null}
        </CanvasBox>
      )}
    </CanvasBox>
  )
}

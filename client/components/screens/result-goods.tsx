import { GoodIcon } from "@/client/components/game/good-icon"
import { PALETTE } from "@/client/components/canvas/tokens"

type Props = {
  title: string
  gold?: number
  goods: readonly { good: string; name: string; count: number }[]
}

export function ResultGoods(props: Props) {
  return (
    <div
      role="group"
      aria-label={props.title}
      style={{ display: "grid", gap: 6 }}
    >
      <span
        style={{
          fontSize: "min(18px, max(12px, calc(var(--u)*3)))",
          fontWeight: 800,
        }}
      >
        {props.title}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {props.gold !== undefined ? (
          <span style={{ fontSize: "min(18px, max(12px, calc(var(--u)*3)))" }}>
            金貨 {props.gold}G
          </span>
        ) : null}
        {props.goods.map((entry) => (
          <span
            key={entry.good}
            style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: 28,
                height: 28,
                background: PALETTE.ink,
                flex: "none",
              }}
            >
              <GoodIcon id={entry.good} />
            </span>
            <span
              style={{ fontSize: "min(18px, max(12px, calc(var(--u)*3)))" }}
            >
              {entry.name} ×{entry.count}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

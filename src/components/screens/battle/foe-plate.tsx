import { COLOR } from "@/components/stage/kit"
import type { FoeView } from "@/components/screens/battle/types"

/** 状態の札（毒・縛りなど）。 */
export function StatusChips({
  status,
  size = 1.8,
}: {
  status: readonly { kind: string; name: string; turns: number }[]
  size?: number
}) {
  if (!status.length) return null
  return (
    <span
      data-foe-statuses
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "flex-end",
        gap: "calc(var(--u)*.5)",
      }}
    >
      {status.map((entry) => (
        <i
          key={entry.kind}
          title={
            entry.kind === "charge" || entry.kind === "protect"
              ? `${entry.name}：使うまで有効`
              : `${entry.name}：残り${entry.turns}手番`
          }
          style={{
            display: "grid",
            placeItems: "center",
            padding: ".15em .45em",
            background:
              entry.kind === "poison"
                ? COLOR.ink
                : entry.kind === "bind"
                  ? COLOR.blood
                  : COLOR.paper,
            clipPath: "polygon(4% 0, 100% 8%, 96% 100%, 0 92%)",
          }}
        >
          <b
            style={{
              fontSize: `max(10px, calc(var(--u)*${size}))`,
              whiteSpace: "nowrap",
              fontStyle: "normal",
              color:
                entry.kind === "poison"
                  ? COLOR.sage
                  : entry.kind === "bind"
                    ? COLOR.paper
                    : COLOR.ink,
            }}
          >
            {entry.name}
            {entry.kind === "charge" || entry.kind === "protect"
              ? ""
              : `${entry.turns}手番`}
          </b>
        </i>
      ))}
    </span>
  )
}

/** 敵の状態・耐性。名前とHPは出さない（手応えと見た目で判断する）。 */
export function FoePlate({ foe, compact }: { foe: FoeView; compact: boolean }) {
  const scale = compact ? 0.72 : 1
  return (
    <div style={{ textAlign: "right" }}>
      <StatusChips status={foe.status} size={1.8 * scale} />
      {foe.resistances.length ? (
        <div
          data-foe-resistances={foe.id}
          style={{
            display: "inline-block",
            maxWidth: "100%",
            marginTop: 4,
            padding: "2px 5px",
            background: COLOR.ink,
            color: COLOR.paper,
            fontSize: `max(10px, calc(var(--u)*${2.1 * scale}))`,
            lineHeight: 1.3,
            overflowWrap: "anywhere",
          }}
        >
          耐性：
          {foe.resistances.map((entry) => entry.label).join("・")}
        </div>
      ) : null}
    </div>
  )
}

import { COLOR } from "@/client/components/stage/kit"
import type { FoeView } from "@/client/components/screens/battle/types"
import { StatusChips } from "@/client/components/screens/battle/status-chips"

/** 敵の状態・耐性。名前とHPは出さない（手応えと見た目で判断する）。 */
type Props = { foe: FoeView; compact: boolean }

export function FoePlate(props: Props) {
  const scale = props.compact ? 0.72 : 1
  return (
    <div style={{ textAlign: "right" }}>
      <StatusChips status={props.foe.status} size={1.8 * scale} />
      {props.foe.resistances.length ? (
        <div
          data-foe-resistances={props.foe.id}
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
          {props.foe.resistances.map((entry) => entry.label).join("・")}
        </div>
      ) : null}
    </div>
  )
}

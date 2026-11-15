import { COLOR } from "@/client/components/stage/kit"

/** 状態の札（毒・縛りなど）。 */
type Props = {
  status: readonly { kind: string; name: string; turns: number }[]
  size?: number
}

export function StatusChips(props: Props) {
  const size = props.size === undefined ? 1.8 : props.size

  if (!props.status.length) return null
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
      {props.status.map((entry) => (
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

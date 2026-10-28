import { useSyncExternalStore } from "react"
import { REVERT } from "@/client/components/canvas/tokens"
import type { FxStore } from "@/client/components/stage/fx/store"
import { FxSlot } from "@/client/components/stage/fx/fx-slot"

type Props = { store: FxStore }

export function FxLayer(props: Props) {
  const items = useSyncExternalStore(
    props.store.subscribe,
    props.store.getSnapshot,
    props.store.getSnapshot
  )
  return (
    <div
      className="fxlayer"
      aria-hidden="true"
      style={{
        ...REVERT,
        display: "block",
        position: "absolute",
        inset: 0,
        zIndex: 30,
        pointerEvents: "none",
        overflow: "clip",
      }}
    >
      {items.map((item) => (
        <FxSlot key={item.id}>{item.node}</FxSlot>
      ))}
    </div>
  )
}

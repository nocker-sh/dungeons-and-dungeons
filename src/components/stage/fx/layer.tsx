import { useSyncExternalStore, type ReactNode } from "react"
import { REVERT } from "@/components/canvas/tokens"
import type { FxStore } from "@/components/stage/fx/store"

export function FxLayer({ store }: { store: FxStore }) {
  const items = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
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

function FxSlot({ children }: { children: ReactNode }) {
  return <>{children}</>
}

import type { ReactNode } from "react"

type Props = { children: ReactNode }

export function FxSlot(props: Props) {
  return <>{props.children}</>
}

import { useRef } from "react"
import { COLOR } from "@/client/components/stage/kit"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import type { ComponentProps } from "react"

type Props = ComponentProps<"button">

export function LootPageButton(props: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(button)
  return (
    <button
      {...props}
      ref={button}
      data-loot-page
      style={{
        ...props.style,
        outline: active ? `3px solid ${COLOR.blood}` : undefined,
        outlineOffset: 2,
      }}
    />
  )
}

import { CanvasButton } from "@/client/components/canvas/canvas-button"
import { useRef } from "react"
import type { ComponentProps } from "react"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { PALETTE } from "@/client/components/canvas/tokens"

type Props = ComponentProps<typeof CanvasButton>

export function RouteChoiceButton(props: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(button)
  return (
    <CanvasButton
      {...props}
      ref={button}
      style={{
        ...props.style,
        outline: active ? `3px solid ${PALETTE.blood}` : undefined,
        outlineOffset: 2,
      }}
    />
  )
}

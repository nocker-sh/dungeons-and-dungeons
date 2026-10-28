import { CanvasButton } from "@/client/components/canvas/canvas-button"
import { PALETTE } from "@/client/components/canvas/tokens"
import { useLayoutEffect, useRef } from "react"
import type { ComponentProps } from "react"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"

type Props = ComponentProps<typeof CanvasButton>

export function DiscoveryButton(props: Props) {
  const button = useRef<HTMLButtonElement>(null)
  const active = useActiveMark(button)
  useLayoutEffect(() => {
    const element = button.current
    if (!active || !element) return
    element.focus({ preventScroll: true })
  }, [active])
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

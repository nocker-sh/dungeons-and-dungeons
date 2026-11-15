import { omitProps } from "@/client/utils/omit-props"
import { useRef } from "react"
import type { ComponentProps, RefObject } from "react"
import { CanvasButton } from "@/client/components/canvas/canvas-button"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { PALETTE } from "@/client/components/canvas/tokens"

/** 方向キー・パッドの選択候補と、選択中の枠を一緒に持つボタン。 */
type Props = Omit<ComponentProps<typeof CanvasButton>, "ref"> & {
  buttonRef?: RefObject<HTMLButtonElement | null>
}

export function NavigationButton(props: Props) {
  const restProps = omitProps(props, ["buttonRef", "style"])

  const ownRef = useRef<HTMLButtonElement>(null)
  const ref = props.buttonRef ?? ownRef
  const active = useActiveMark(ref)
  return (
    <CanvasButton
      {...restProps}
      ref={ref}
      data-nav-button
      style={{
        ...props.style,
        outline: active
          ? `3px solid ${PALETTE.ink}`
          : (props.style?.outline ?? "none"),
        outlineOffset: active ? 3 : props.style?.outlineOffset,
      }}
    />
  )
}

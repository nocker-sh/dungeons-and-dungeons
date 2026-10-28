"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

type Props = SheetPrimitive.Backdrop.Props

export function SheetOverlay(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        props.className
      )}
      {...restProps}
    />
  )
}

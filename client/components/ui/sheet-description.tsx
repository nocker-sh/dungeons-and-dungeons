"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

type Props = SheetPrimitive.Description.Props

export function SheetDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", props.className)}
      {...restProps}
    />
  )
}

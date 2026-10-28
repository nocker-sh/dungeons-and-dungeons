"use client"

import { omitProps } from "@/client/utils/omit-props"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"
import { cn } from "cn"

type Props = SheetPrimitive.Title.Props

export function SheetTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}

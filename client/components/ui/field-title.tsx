"use client"

import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function FieldTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50",
        props.className
      )}
      {...restProps}
    />
  )
}

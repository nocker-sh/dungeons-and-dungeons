"use client"

import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function FieldContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-0.5 leading-snug",
        props.className
      )}
      {...restProps}
    />
  )
}

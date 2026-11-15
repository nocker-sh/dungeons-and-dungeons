"use client"

import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function FieldGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
        props.className
      )}
      {...restProps}
    />
  )
}

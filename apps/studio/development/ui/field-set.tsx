"use client"

import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"fieldset">

export function FieldSet(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        props.className
      )}
      {...restProps}
    />
  )
}

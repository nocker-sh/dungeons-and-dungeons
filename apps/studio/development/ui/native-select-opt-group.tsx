import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"optgroup">

export function NativeSelectOptGroup(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", props.className)}
      {...restProps}
    />
  )
}

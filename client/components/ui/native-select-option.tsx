import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"option">

export function NativeSelectOption(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", props.className)}
      {...restProps}
    />
  )
}

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function DrawerFooter(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "mt-auto flex shrink-0 flex-col gap-2 p-4 pt-0",
        props.className
      )}
      {...restProps}
    />
  )
}

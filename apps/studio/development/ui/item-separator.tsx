import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Separator } from "@/development/ui/separator"

type Props = React.ComponentProps<typeof Separator>

export function ItemSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <Separator
      data-slot="item-separator"
      orientation="horizontal"
      className={cn("my-2", props.className)}
      {...restProps}
    />
  )
}

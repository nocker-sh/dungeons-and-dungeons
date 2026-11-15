import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"p">

export function ItemDescription(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <p
      data-slot="item-description"
      className={cn(
        "line-clamp-2 text-left text-sm leading-normal font-normal text-muted-foreground group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        props.className
      )}
      {...restProps}
    />
  )
}

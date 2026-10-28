import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Input } from "@/client/components/ui/input"

type Props = React.ComponentProps<"input">

export function InputGroupInput(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <Input
      data-slot="input-group-control"
      className={cn(
        "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
        props.className
      )}
      {...restProps}
    />
  )
}

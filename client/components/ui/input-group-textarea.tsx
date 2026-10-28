import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { Textarea } from "@/client/components/ui/textarea"

type Props = React.ComponentProps<"textarea">

export function InputGroupTextarea(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(
        "flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
        props.className
      )}
      {...restProps}
    />
  )
}

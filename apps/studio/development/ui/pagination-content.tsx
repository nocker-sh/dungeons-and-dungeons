import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"ul">

export function PaginationContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ul
      data-slot="pagination-content"
      className={cn("flex items-center gap-0.5", props.className)}
      {...restProps}
    />
  )
}

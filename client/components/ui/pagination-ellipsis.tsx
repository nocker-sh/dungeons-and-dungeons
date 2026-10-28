import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { MoreHorizontalIcon } from "lucide-react"

type Props = React.ComponentProps<"span">

export function PaginationEllipsis(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <span
      aria-hidden
      data-slot="pagination-ellipsis"
      className={cn(
        "flex size-8 items-center justify-center [&_svg:not([class*='size-'])]:size-4",
        props.className
      )}
      {...restProps}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More pages</span>
    </span>
  )
}

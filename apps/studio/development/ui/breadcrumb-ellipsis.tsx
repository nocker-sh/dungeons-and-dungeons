import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { MoreHorizontalIcon } from "lucide-react"

type Props = React.ComponentProps<"span">

export function BreadcrumbEllipsis(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      aria-hidden="true"
      className={cn(
        "flex size-5 items-center justify-center [&>svg]:size-4",
        props.className
      )}
      {...restProps}
    >
      <MoreHorizontalIcon />
      <span className="sr-only">More</span>
    </span>
  )
}

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"li">

export function BreadcrumbItem(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <li
      data-slot="breadcrumb-item"
      className={cn("inline-flex items-center gap-1", props.className)}
      {...restProps}
    />
  )
}

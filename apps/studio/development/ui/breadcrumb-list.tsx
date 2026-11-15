import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"ol">

export function BreadcrumbList(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-sm wrap-break-word text-muted-foreground",
        props.className
      )}
      {...restProps}
    />
  )
}

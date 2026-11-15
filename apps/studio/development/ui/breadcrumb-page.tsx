import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"span">

export function BreadcrumbPage(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn("font-normal text-foreground", props.className)}
      {...restProps}
    />
  )
}

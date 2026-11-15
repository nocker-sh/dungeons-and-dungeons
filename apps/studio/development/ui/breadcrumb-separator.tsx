import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"
import { ChevronRightIcon } from "lucide-react"

type Props = React.ComponentProps<"li">

export function BreadcrumbSeparator(props: Props) {
  const restProps = omitProps(props, ["children", "className"])

  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn("[&>svg]:size-3.5", props.className)}
      {...restProps}
    >
      {props.children ?? <ChevronRightIcon />}
    </li>
  )
}

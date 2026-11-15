import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"nav">

export function Pagination(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      data-slot="pagination"
      className={cn("mx-auto flex w-full justify-center", props.className)}
      {...restProps}
    />
  )
}

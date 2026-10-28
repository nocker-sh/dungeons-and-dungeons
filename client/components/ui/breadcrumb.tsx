import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { cn } from "cn"

type Props = React.ComponentProps<"nav">

export function Breadcrumb(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <nav
      aria-label="breadcrumb"
      data-slot="breadcrumb"
      className={cn(props.className)}
      {...restProps}
    />
  )
}

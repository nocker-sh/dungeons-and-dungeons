import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"

type Props = React.ComponentProps<"li">

export function PaginationItem(props: Props) {
  const restProps = omitProps(props, [])

  return <li data-slot="pagination-item" {...restProps} />
}

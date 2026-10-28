import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { DropdownMenuPortal } from "@/client/components/ui/dropdown-menu-portal"

type Props = React.ComponentProps<typeof DropdownMenuPortal>

export function MenubarPortal(props: Props) {
  const restProps = omitProps(props, [])

  return <DropdownMenuPortal data-slot="menubar-portal" {...restProps} />
}

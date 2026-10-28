import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { DropdownMenuGroup } from "@/client/components/ui/dropdown-menu-group"

type Props = React.ComponentProps<typeof DropdownMenuGroup>

export function MenubarGroup(props: Props) {
  const restProps = omitProps(props, [])

  return <DropdownMenuGroup data-slot="menubar-group" {...restProps} />
}

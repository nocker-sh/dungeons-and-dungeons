import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { DropdownMenu } from "@/client/components/ui/dropdown-menu"

type Props = React.ComponentProps<typeof DropdownMenu>

export function MenubarMenu(props: Props) {
  const restProps = omitProps(props, [])

  return <DropdownMenu data-slot="menubar-menu" {...restProps} />
}

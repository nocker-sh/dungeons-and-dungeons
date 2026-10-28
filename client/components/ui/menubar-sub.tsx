import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { DropdownMenuSub } from "@/client/components/ui/dropdown-menu-sub"

type Props = React.ComponentProps<typeof DropdownMenuSub>

export function MenubarSub(props: Props) {
  const restProps = omitProps(props, [])

  return <DropdownMenuSub data-slot="menubar-sub" {...restProps} />
}

import { omitProps } from "@/client/utils/omit-props"
import * as React from "react"
import { DropdownMenuRadioGroup } from "@/client/components/ui/dropdown-menu-radio-group"

type Props = React.ComponentProps<typeof DropdownMenuRadioGroup>

export function MenubarRadioGroup(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <DropdownMenuRadioGroup data-slot="menubar-radio-group" {...restProps} />
  )
}

import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

type Props = ContextMenuPrimitive.Group.Props

export function ContextMenuGroup(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <ContextMenuPrimitive.Group data-slot="context-menu-group" {...restProps} />
  )
}

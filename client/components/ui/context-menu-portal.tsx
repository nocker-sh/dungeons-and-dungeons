import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

type Props = ContextMenuPrimitive.Portal.Props

export function ContextMenuPortal(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <ContextMenuPrimitive.Portal
      data-slot="context-menu-portal"
      {...restProps}
    />
  )
}

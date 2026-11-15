import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

type Props = ContextMenuPrimitive.SubmenuRoot.Props

export function ContextMenuSub(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <ContextMenuPrimitive.SubmenuRoot
      data-slot="context-menu-sub"
      {...restProps}
    />
  )
}

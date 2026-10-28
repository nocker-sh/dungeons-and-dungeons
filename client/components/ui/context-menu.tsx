import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

type Props = ContextMenuPrimitive.Root.Props

export function ContextMenu(props: Props) {
  const restProps = omitProps(props, [])

  return <ContextMenuPrimitive.Root data-slot="context-menu" {...restProps} />
}

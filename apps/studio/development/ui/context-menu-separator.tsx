import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"

type Props = ContextMenuPrimitive.Separator.Props

export function ContextMenuSeparator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ContextMenuPrimitive.Separator
      data-slot="context-menu-separator"
      className={cn("-mx-1 my-1 h-px bg-border", props.className)}
      {...restProps}
    />
  )
}

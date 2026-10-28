import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"
import { cn } from "cn"

type Props = ContextMenuPrimitive.Trigger.Props

export function ContextMenuTrigger(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ContextMenuPrimitive.Trigger
      data-slot="context-menu-trigger"
      className={cn("select-none", props.className)}
      {...restProps}
    />
  )
}

import { omitProps } from "@/client/utils/omit-props"
import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

type Props = ContextMenuPrimitive.RadioGroup.Props

export function ContextMenuRadioGroup(props: Props) {
  const restProps = omitProps(props, [])

  return (
    <ContextMenuPrimitive.RadioGroup
      data-slot="context-menu-radio-group"
      {...restProps}
    />
  )
}

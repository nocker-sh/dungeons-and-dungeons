import { omitProps } from "@/client/utils/omit-props"
import { Menubar as MenubarPrimitive } from "@base-ui/react/menubar"
import { cn } from "cn"

type Props = MenubarPrimitive.Props

export function Menubar(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <MenubarPrimitive
      data-slot="menubar"
      className={cn(
        "flex h-8 items-center gap-0.5 rounded-lg border p-[3px]",
        props.className
      )}
      {...restProps}
    />
  )
}

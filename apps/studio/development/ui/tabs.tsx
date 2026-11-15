import { omitProps } from "@/client/utils/omit-props"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"

type Props = TabsPrimitive.Root.Props

export function Tabs(props: Props) {
  const orientation =
    props.orientation === undefined ? "horizontal" : props.orientation
  const restProps = omitProps(props, ["className", "orientation"])

  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        props.className
      )}
      {...restProps}
    />
  )
}

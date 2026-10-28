import { omitProps } from "@/client/utils/omit-props"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "cn"

type Props = TabsPrimitive.Panel.Props

export function TabsContent(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", props.className)}
      {...restProps}
    />
  )
}

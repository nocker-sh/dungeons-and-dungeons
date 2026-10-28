import { omitProps } from "@/client/utils/omit-props"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { tabsListVariants } from "@/client/components/ui/tabs-list-variants"

export type Props = TabsPrimitive.List.Props &
  VariantProps<typeof tabsListVariants>

export function TabsList(props: Props) {
  const variant = props.variant === undefined ? "default" : props.variant
  const restProps = omitProps(props, ["className", "variant"])

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), props.className)}
      {...restProps}
    />
  )
}

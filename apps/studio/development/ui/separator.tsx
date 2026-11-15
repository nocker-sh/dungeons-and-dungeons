import { omitProps } from "@/client/utils/omit-props"
import { Separator as SeparatorPrimitive } from "@base-ui/react/separator"
import { cn } from "cn"

type Props = SeparatorPrimitive.Props

export function Separator(props: Props) {
  const orientation =
    props.orientation === undefined ? "horizontal" : props.orientation
  const restProps = omitProps(props, ["className", "orientation"])

  return (
    <SeparatorPrimitive
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        props.className
      )}
      {...restProps}
    />
  )
}

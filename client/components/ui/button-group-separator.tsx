import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"
import { Separator } from "@/client/components/ui/separator"

type Props = React.ComponentProps<typeof Separator>

export function ButtonGroupSeparator(props: Props) {
  const orientation =
    props.orientation === undefined ? "vertical" : props.orientation
  const restProps = omitProps(props, ["className", "orientation"])

  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "relative self-stretch bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto",
        props.className
      )}
      {...restProps}
    />
  )
}

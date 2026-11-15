import { omitProps } from "@/client/utils/omit-props"
import type { VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { buttonGroupVariants } from "@/development/ui/button-group-variants"

export type Props = React.ComponentProps<"div"> &
  VariantProps<typeof buttonGroupVariants>

export function ButtonGroup(props: Props) {
  const restProps = omitProps(props, ["className", "orientation"])

  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={props.orientation}
      className={cn(
        buttonGroupVariants({ orientation: props.orientation }),
        props.className
      )}
      {...restProps}
    />
  )
}

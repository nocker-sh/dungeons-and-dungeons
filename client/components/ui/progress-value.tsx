import { omitProps } from "@/client/utils/omit-props"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "cn"

type Props = ProgressPrimitive.Value.Props

export function ProgressValue(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ProgressPrimitive.Value
      className={cn(
        "ml-auto text-sm text-muted-foreground tabular-nums",
        props.className
      )}
      data-slot="progress-value"
      {...restProps}
    />
  )
}

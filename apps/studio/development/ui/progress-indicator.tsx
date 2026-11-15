import { omitProps } from "@/client/utils/omit-props"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "cn"

type Props = ProgressPrimitive.Indicator.Props

export function ProgressIndicator(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn("h-full bg-primary transition-all", props.className)}
      {...restProps}
    />
  )
}

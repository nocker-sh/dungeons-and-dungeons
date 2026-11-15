import { omitProps } from "@/client/utils/omit-props"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "cn"

type Props = ProgressPrimitive.Label.Props

export function ProgressLabel(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ProgressPrimitive.Label
      className={cn("text-sm font-medium", props.className)}
      data-slot="progress-label"
      {...restProps}
    />
  )
}

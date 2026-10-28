import { omitProps } from "@/client/utils/omit-props"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "cn"
import { ProgressTrack } from "@/client/components/ui/progress-track"
import { ProgressIndicator } from "@/client/components/ui/progress-indicator"

type Props = ProgressPrimitive.Root.Props

export function Progress(props: Props) {
  const restProps = omitProps(props, ["className", "children", "value"])

  return (
    <ProgressPrimitive.Root
      value={props.value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", props.className)}
      {...restProps}
    >
      {props.children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}

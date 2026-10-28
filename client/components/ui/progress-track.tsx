import { omitProps } from "@/client/utils/omit-props"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"
import { cn } from "cn"

type Props = ProgressPrimitive.Track.Props

export function ProgressTrack(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <ProgressPrimitive.Track
      className={cn(
        "relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-muted",
        props.className
      )}
      data-slot="progress-track"
      {...restProps}
    />
  )
}

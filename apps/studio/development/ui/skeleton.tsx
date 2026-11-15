import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function Skeleton(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", props.className)}
      {...restProps}
    />
  )
}

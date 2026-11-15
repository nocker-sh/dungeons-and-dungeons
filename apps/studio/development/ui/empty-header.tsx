import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function EmptyHeader(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="empty-header"
      className={cn(
        "flex max-w-sm flex-col items-center gap-2",
        props.className
      )}
      {...restProps}
    />
  )
}

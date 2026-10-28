import { omitProps } from "@/client/utils/omit-props"
import { cn } from "cn"

type Props = React.ComponentProps<"div">

export function EmptyTitle(props: Props) {
  const restProps = omitProps(props, ["className"])

  return (
    <div
      data-slot="empty-title"
      className={cn(
        "font-heading text-sm font-medium tracking-tight",
        props.className
      )}
      {...restProps}
    />
  )
}
